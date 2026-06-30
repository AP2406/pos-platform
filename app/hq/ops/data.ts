import { createAdminClient } from "@/lib/supabase/admin";
import { listMerchants, type MerchantRow } from "../merchants/data";

type AdminDb = ReturnType<typeof createAdminClient>;

export type OpsDispute = { id: string; businessId: string | null; businessName: string; transferId: string | null; amount: number; state: string; reason: string | null; createdAt: string };
export type OpsIncident = { id: string; businessName: string; type: string; severity: string; body: string; createdByName: string | null; createdAt: string };
export type AtRisk = { merchant: MerchantRow; reason: string };

export type Ops = {
  disputes: OpsDispute[];
  openDisputeCount: number;
  incidents: OpsIncident[];
  atRisk: AtRisk[];
};

const CLOSED = new Set(["won", "lost", "resolved", "closed"]);

export async function buildOps(db: AdminDb): Promise<Ops> {
  const [{ data: biz }, { data: disputeRows }, { data: incidentRows }, merchants] = await Promise.all([
    db.from("businesses").select("id, name"),
    db.from("finix_disputes").select("id, business_id, finix_transfer_id, amount_cents, state, reason, created_at").order("created_at", { ascending: false }).limit(100),
    db.from("customer_incidents").select("id, business_id, type, severity, body, created_by_name, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    listMerchants(db),
  ]);
  const name = new Map((biz ?? []).map((b) => [b.id as string, (b.name as string) || "—"]));

  const disputes: OpsDispute[] = (disputeRows ?? []).map((d) => ({
    id: d.id as string,
    businessId: (d.business_id as string | null) ?? null,
    businessName: d.business_id ? name.get(d.business_id as string) ?? "—" : "(unmatched)",
    transferId: (d.finix_transfer_id as string | null) ?? null,
    amount: (Number(d.amount_cents) || 0) / 100,
    state: (d.state as string) || "—",
    reason: (d.reason as string | null) ?? null,
    createdAt: (d.created_at as string) ?? "",
  }));
  const openDisputeCount = disputes.filter((d) => !CLOSED.has((d.state || "").toLowerCase())).length;

  const incidents: OpsIncident[] = (incidentRows ?? []).map((i) => ({
    id: i.id as string,
    businessName: name.get(i.business_id as string) ?? "—",
    type: (i.type as string) || "—",
    severity: (i.severity as string) || "medium",
    body: (i.body as string) || "",
    createdByName: (i.created_by_name as string | null) ?? null,
    createdAt: (i.created_at as string) ?? "",
  }));

  // At-risk: paused tenants, or live tenants with no order in 14+ days, or onboarding
  // tenants with no Finix merchant.
  const now = Date.now();
  const atRisk: AtRisk[] = [];
  for (const m of merchants) {
    if (m.isDemo) continue;
    if (m.status === "paused") atRisk.push({ merchant: m, reason: "Paused / suspended" });
    else if (m.status === "live") {
      const last = m.lastOrderAt ? new Date(m.lastOrderAt).getTime() : 0;
      if (!last || now - last > 14 * 86400000) atRisk.push({ merchant: m, reason: m.lastOrderAt ? "No orders in 14+ days" : "Live but no orders yet" });
    } else if (m.status === "onboarding" && !m.finixMerchantId) {
      atRisk.push({ merchant: m, reason: "Onboarding — no Finix merchant yet" });
    }
  }

  return { disputes, openDisputeCount, incidents, atRisk };
}
