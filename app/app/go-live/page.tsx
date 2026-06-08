import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { setGoLiveFlag } from "./actions";

export const dynamic = "force-dynamic";

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-amber-500">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ConfirmButton(props: { label: string; flagKey: string }) {
  return (
    <form action={setGoLiveFlag}>
      <input type="hidden" name="key" value={props.flagKey} />
      <input type="hidden" name="value" value="true" />
      <button
        type="submit"
        className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
      >
        {props.label}
      </button>
    </form>
  );
}

export default async function GoLivePage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("name, default_tax_rate, finix_merchant_id, finix_merchant_state, go_live")
    .eq("id", business.id)
    .maybeSingle();

  const goLive =
    biz && biz.go_live && typeof biz.go_live === "object"
      ? (biz.go_live as Record<string, unknown>)
      : {};

  const { count: itemCountRaw } = await supabase
    .from("catalog_items")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("is_active", true);
  const itemCount = itemCountRaw || 0;

  const { count: drawerCountRaw } = await supabase
    .from("drawer_sessions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  const drawerCount = drawerCountRaw || 0;

  // ---- compute each check ----
  const nameSet = Boolean(biz && biz.name && String(biz.name).trim().length > 0);

  const catalogDone = itemCount > 0;

  let taxRate = Number(biz && biz.default_tax_rate);
  if (isNaN(taxRate)) taxRate = 0;
  let taxPercent = taxRate;
  if (taxPercent > 1) {
    // already a percent
  } else {
    taxPercent = taxPercent * 100;
  }
  const taxFreeConfirmed = goLive["tax_free"] === true;
  const taxDone = taxRate > 0 || taxFreeConfirmed;

  const merchantState = String((biz && biz.finix_merchant_state) || "").toUpperCase();
  const cardApproved = merchantState === "APPROVED";
  const cashOnlyConfirmed = goLive["cash_only"] === true;
  const paymentsDone = cardApproved || cashOnlyConfirmed;

  const registerDone = drawerCount > 0;

  const legalAccepted = goLive["legal_accepted"] === true;

  const requiredDone =
    catalogDone && taxDone && paymentsDone && registerDone && legalAccepted;

  const requiredItems = [catalogDone, taxDone, paymentsDone, registerDone, legalAccepted];
  const remaining = requiredItems.filter(function (d) {
    return !d;
  }).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Go-live checklist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A quick run-through to make sure {nameSet ? String(biz!.name) : "your business"} is
          ready to take real payments.
        </p>
      </div>

      {requiredDone ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <span className="text-emerald-600">
            <CheckIcon />
          </span>
          <div>
            <div className="text-sm font-semibold text-emerald-800">
              You&apos;re ready to go live.
            </div>
            <div className="text-xs text-emerald-700">
              Everything required is in place. You can start taking real sales.
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-amber-500">
            <PendingIcon />
          </span>
          <div>
            <div className="text-sm font-semibold text-amber-800">
              {remaining} item{remaining === 1 ? "" : "s"} left before you&apos;re ready.
            </div>
            <div className="text-xs text-amber-700">
              Work through the list below. Each one links to where you can finish it.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card divide-y">
        <Row done={nameSet} title="Business basics" detail={nameSet ? "Name set." : "Set your business name."}>
          {!nameSet ? (
            <Link href="/app/settings" className="text-xs font-medium underline">
              Settings
            </Link>
          ) : null}
        </Row>

        <Row
          done={catalogDone}
          title="Menu &amp; items"
          detail={
            catalogDone
              ? itemCount + " active item" + (itemCount === 1 ? "" : "s") + "."
              : "Add at least one item to sell."
          }
        >
          <Link href="/app/catalog" className="text-xs font-medium underline">
            {catalogDone ? "Manage catalog" : "Add items"}
          </Link>
        </Row>

        <Row
          done={taxDone}
          title="Tax"
          detail={
            taxRate > 0
              ? "Rate set (" + (Math.round(taxPercent * 100) / 100) + "%)."
              : taxFreeConfirmed
                ? "Marked tax-free."
                : "Set a tax rate, or confirm you don&apos;t charge tax."
          }
        >
          {!taxDone ? (
            <div className="flex items-center gap-3">
              <Link href="/app/settings" className="text-xs font-medium underline">
                Set rate
              </Link>
              <ConfirmButton label="We&apos;re tax-free" flagKey="tax_free" />
            </div>
          ) : null}
        </Row>

        <Row
          done={paymentsDone}
          title="Card payments"
          detail={
            cardApproved
              ? "Finix approved &mdash; card payments are active."
              : cashOnlyConfirmed
                ? "Cash-only for now (cards not connected)."
                : "Connect card processing, or confirm you&apos;ll take cash only for now."
          }
        >
          {!paymentsDone ? (
            <div className="flex items-center gap-3">
              <Link href="/app/settings" className="text-xs font-medium underline">
                Payment setup
              </Link>
              <ConfirmButton label="Cash only for now" flagKey="cash_only" />
            </div>
          ) : null}
        </Row>

        <Row
          done={registerDone}
          title="Open the register"
          detail={
            registerDone
              ? "A drawer session has been opened."
              : "Open a cash drawer at least once so you&apos;re ready to ring sales."
          }
        >
          {!registerDone ? (
            <Link href="/app/pos" className="text-xs font-medium underline">
              Go to register
            </Link>
          ) : null}
        </Row>

        <Row
          done={legalAccepted}
          title="Legal &amp; agreements"
          detail={
            legalAccepted
              ? "Agreements accepted."
              : "Review and accept the Master Services Agreement and Payment Disclosure."
          }
        >
          {!legalAccepted ? (
            <ConfirmButton label="I accept" flagKey="legal_accepted" />
          ) : null}
        </Row>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Items marked done are detected automatically except the ones you confirm here.
      </p>
    </div>
  );
}

function Row(props: {
  done: boolean;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 shrink-0">
        {props.done ? <CheckIcon /> : <PendingIcon />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: props.title }} />
        <div
          className="text-xs text-muted-foreground mt-0.5"
          dangerouslySetInnerHTML={{ __html: props.detail }}
        />
      </div>
      {props.children ? <div className="shrink-0 mt-0.5">{props.children}</div> : null}
    </div>
  );
}