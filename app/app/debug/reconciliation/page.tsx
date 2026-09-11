import { requireBusiness } from "@/lib/services/tenancy";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

function getAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

function money(cents: number, currency: string): string {
  const cur = currency || "CAD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
    }).format(cents / 100);
  } catch {
    return "$" + (cents / 100).toFixed(2);
  }
}

function shortId(id: string): string {
  if (!id) return "\u2014";
  if (id.length <= 14) return id;
  return id.slice(0, 9) + "\u2026" + id.slice(-4);
}

// Map a Finix transfer state to our finix_payments.status vocabulary.
function mapFinixState(state: string): string {
  const s = String(state || "").toLowerCase();
  if (s === "succeeded") return "succeeded";
  if (s === "failed") return "failed";
  if (s === "pending") return "pending";
  if (s === "canceled" || s === "cancelled") return "canceled";
  return s;
}

type EventRef = { ev: Row; t: Row };

export default async function ReconciliationPage() {
  const { business } = await requireBusiness();
  const db = getAdmin();

  if (!db) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Finix reconciliation
        </h1>
        <p className="text-red-600 mt-4 text-sm">
          Supabase admin client unavailable &mdash; SUPABASE_SERVICE_ROLE_KEY is
          not set in this environment.
        </p>
      </div>
    );
  }

  // 1) This business's recorded payments.
  const paymentsRes = await db
    .from("finix_payments")
    .select(
      "id, finix_transfer_id, finix_merchant_id, amount_cents, currency, status, failure_code, created_at"
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const payments = (paymentsRes.data ?? []) as Row[];

  const merchantIds = new Set<string>();
  const paymentByTransfer = new Map<string, Row>();
  for (const p of payments) {
    if (p.finix_merchant_id) merchantIds.add(String(p.finix_merchant_id));
    if (p.finix_transfer_id)
      paymentByTransfer.set(String(p.finix_transfer_id), p);
  }

  // 2) Webhook events Finix actually delivered (bounded 90-day window).
  // finix_webhook_events has no business_id, so we read the window and match
  // by transfer id / merchant id in memory, scoped to this business only.
  const sinceIso = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();
  const eventsRes = await db
    .from("finix_webhook_events")
    .select("id, type, entity, occurred_at, payload, processed, process_error")
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: true })
    .limit(5000);

  const events = (eventsRes.data ?? []) as Row[];
  let eventsWithProcessError = 0;

  const eventsByTransfer = new Map<string, EventRef[]>();
  for (const ev of events) {
    if (ev.process_error) eventsWithProcessError += 1;
    if (ev.entity !== "transfer") continue;
    const payload = ev.payload as { _embedded?: { transfers?: Row[] } } | null;
    const list =
      payload && payload._embedded && payload._embedded.transfers
        ? payload._embedded.transfers
        : [];
    const t = Array.isArray(list) && list.length > 0 ? list[0] : null;
    if (!t || !t.id) continue;
    const tid = String(t.id);
    const arr = eventsByTransfer.get(tid) || [];
    arr.push({ ev: ev, t: t });
    eventsByTransfer.set(tid, arr);
  }

  function latestOf(refs: EventRef[]): EventRef {
    let latest = refs[0];
    for (const r of refs) {
      if (String(r.ev.occurred_at || "") >= String(latest.ev.occurred_at || ""))
        latest = r;
    }
    return latest;
  }

  type ReconRow = {
    transferId: string;
    ourStatus: string;
    ourAmount: number;
    ourCurrency: string;
    finixState: string;
    finixMapped: string;
    finixAmount: number | null;
    eventCount: number;
    flag: string;
  };

  const rows: ReconRow[] = [];
  let okCount = 0;
  let unconfirmed = 0;
  let stateMismatch = 0;
  let amountMismatch = 0;

  for (const p of payments) {
    const tid = String(p.finix_transfer_id || "");
    const refs = tid ? eventsByTransfer.get(tid) : undefined;
    let finixState = "";
    let finixAmount: number | null = null;
    let eventCount = 0;

    if (refs && refs.length > 0) {
      eventCount = refs.length;
      const latest = latestOf(refs);
      finixState = String(latest.t.state || "");
      finixAmount = num(latest.t.amount);
    }

    const ourStatus = String(p.status || "");
    const finixMapped = finixState ? mapFinixState(finixState) : "";
    let flag = "OK";

    if (!refs || refs.length === 0) {
      flag = "UNCONFIRMED";
      unconfirmed += 1;
    } else if (finixMapped && ourStatus && finixMapped !== ourStatus) {
      flag = "STATE_MISMATCH";
      stateMismatch += 1;
    } else if (finixAmount !== null && num(p.amount_cents) !== finixAmount) {
      flag = "AMOUNT_MISMATCH";
      amountMismatch += 1;
    } else {
      okCount += 1;
    }

    rows.push({
      transferId: tid,
      ourStatus: ourStatus,
      ourAmount: num(p.amount_cents),
      ourCurrency: String(p.currency || ""),
      finixState: finixState,
      finixMapped: finixMapped,
      finixAmount: finixAmount,
      eventCount: eventCount,
      flag: flag,
    });
  }

  // Orphans: transfers Finix reported for THIS business's merchants that have
  // no matching finix_payments row.
  type Orphan = {
    transferId: string;
    state: string;
    amount: number;
    currency: string;
  };
  const orphans: Orphan[] = [];
  for (const entry of eventsByTransfer.entries()) {
    const tid = entry[0];
    const refs = entry[1];
    if (paymentByTransfer.has(tid)) continue;
    const latest = latestOf(refs);
    const merch = String(latest.t.merchant || "");
    if (!merchantIds.has(merch)) continue;
    orphans.push({
      transferId: tid,
      state: String(latest.t.state || ""),
      amount: num(latest.t.amount),
      currency: String(latest.t.currency || ""),
    });
  }

  const cleanGate =
    stateMismatch === 0 &&
    amountMismatch === 0 &&
    orphans.length === 0 &&
    eventsWithProcessError === 0;

  return (
    <div className="max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Finix reconciliation
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compares payments Surge recorded against the states Finix reported via
          webhooks, for {business.name}. Last 90 days.
        </p>
      </div>

      <div
        className={
          "mt-5 rounded-lg border p-4 text-sm " +
          (cleanGate
            ? "border-green-200 bg-green-50/40 text-green-800"
            : "border-amber-200 bg-amber-50/40 text-amber-800")
        }
      >
        {cleanGate
          ? "All recorded payments match Finix, no orphans, no processing errors."
          : "Discrepancies found below \u2014 review the flagged rows."}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <StatCard label="Recorded payments" value={payments.length.toString()} />
        <StatCard label="Matched" value={okCount.toString()} tone="good" />
        <StatCard
          label="Unconfirmed"
          value={unconfirmed.toString()}
          tone={unconfirmed > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="State mismatches"
          value={stateMismatch.toString()}
          tone={stateMismatch > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Amount mismatches"
          value={amountMismatch.toString()}
          tone={amountMismatch > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Orphan transfers"
          value={orphans.length.toString()}
          tone={orphans.length > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Event errors"
          value={eventsWithProcessError.toString()}
          tone={eventsWithProcessError > 0 ? "bad" : "neutral"}
        />
        <StatCard label="Webhook events" value={events.length.toString()} />
      </div>

      <SectionHeader>Payments vs Finix</SectionHeader>
      {rows.length === 0 ? (
        <EmptyState message="No recorded payments for this business yet." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="p-3 font-medium">Transfer</th>
                <th className="p-3 font-medium">Our status</th>
                <th className="p-3 font-medium">Finix state</th>
                <th className="p-3 font-medium">Our amount</th>
                <th className="p-3 font-medium">Finix amount</th>
                <th className="p-3 font-medium">Events</th>
                <th className="p-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.transferId} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs">{shortId(r.transferId)}</td>
                  <td className="p-3">{r.ourStatus || "\u2014"}</td>
                  <td className="p-3">{r.finixState || "\u2014"}</td>
                  <td className="p-3 tabular-nums">{money(r.ourAmount, r.ourCurrency)}</td>
                  <td className="p-3 tabular-nums">
                    {r.finixAmount === null ? "\u2014" : money(r.finixAmount, r.ourCurrency)}
                  </td>
                  <td className="p-3 tabular-nums">{r.eventCount}</td>
                  <td className="p-3">
                    <FlagBadge flag={r.flag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orphans.length > 0 && (
        <>
          <SectionHeader>Orphan transfers (Finix has, Surge doesn&apos;t)</SectionHeader>
          <div className="bg-card border border-red-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3 font-medium">Transfer</th>
                  <th className="p-3 font-medium">Finix state</th>
                  <th className="p-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <tr key={o.transferId} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono text-xs">{shortId(o.transferId)}</td>
                    <td className="p-3">{o.state || "\u2014"}</td>
                    <td className="p-3 tabular-nums">{money(o.amount, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHeader>What the results mean</SectionHeader>
      <div className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground space-y-1">
        <div><span className="text-green-700 font-medium">Matched</span> &mdash; Finix confirmed this payment and the state and amount agree.</div>
        <div><span className="text-amber-700 font-medium">Unconfirmed</span> &mdash; Surge recorded it but no Finix webhook has arrived yet (could be in-flight, or never delivered).</div>
        <div><span className="text-red-700 font-medium">State mismatch</span> &mdash; Surge and Finix disagree on the outcome (e.g. Surge says succeeded, Finix says failed).</div>
        <div><span className="text-red-700 font-medium">Amount mismatch</span> &mdash; the amount Surge recorded differs from the amount on Finix&apos;s transfer.</div>
        <div><span className="text-red-700 font-medium">Orphan</span> &mdash; Finix reported a transfer for your merchant that Surge has no record of.</div>
        <div><span className="text-red-700 font-medium">Event errors</span> &mdash; webhooks Surge received but failed to process (check process_error in finix_webhook_events).</div>
      </div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  let cls = "bg-secondary text-secondary-foreground";
  let label = flag;
  if (flag === "OK") {
    cls = "bg-green-50 text-green-700";
    label = "Matched";
  } else if (flag === "UNCONFIRMED") {
    cls = "bg-amber-50 text-amber-700";
    label = "Unconfirmed";
  } else if (flag === "STATE_MISMATCH") {
    cls = "bg-red-50 text-red-700";
    label = "State mismatch";
  } else if (flag === "AMOUNT_MISMATCH") {
    cls = "bg-red-50 text-red-700";
    label = "Amount mismatch";
  }
  return (
    <span className={"text-xs px-2 py-0.5 rounded " + cls}>{label}</span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-3 mt-8">
      {children}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warning" | "bad" | "neutral";
}) {
  let valueClass = "text-foreground";
  if (tone === "good") valueClass = "text-green-600";
  else if (tone === "warning") valueClass = "text-amber-600";
  else if (tone === "bad") valueClass = "text-red-600";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={"text-2xl font-semibold mt-2 tabular-nums tracking-tight " + valueClass}>
        {value}
      </div>
    </div>
  );
}