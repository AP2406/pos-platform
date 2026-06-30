import { createAdminClient } from "@/lib/supabase/admin";

type AdminDb = ReturnType<typeof createAdminClient>;

export type MerchantStatus = "onboarding" | "live" | "paused";

export type MerchantRow = {
  id: string;
  name: string;
  orgName: string;
  industry: string;
  isDemo: boolean;
  status: MerchantStatus;
  plan: string | null;
  customMrr: number | null;
  repId: string | null;
  locationCount: number;
  finixMerchantId: string | null;
  finixState: string | null;
  createdAt: string;
  lastOrderAt: string | null;
  vol30d: number;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function deriveStatus(accessStatus: string | null, finixState: string | null): MerchantStatus {
  if (accessStatus === "suspended" || accessStatus === "past_due") return "paused";
  if ((finixState || "").toUpperCase() === "APPROVED") return "live";
  return "onboarding";
}

// Cross-tenant directory. Reads via the service-role db (passed by the gated
// caller). NOTE: orders are aggregated in JS — fine at current scale; becomes a
// rollup RPC/materialized view when volume grows.
export async function listMerchants(db: AdminDb): Promise<MerchantRow[]> {
  const [{ data: biz }, { data: orgs }, { data: orders }] = await Promise.all([
    db.from("businesses").select("id, name, industry, access_status, is_demo, org_id, finix_merchant_id, finix_merchant_state, plan, custom_mrr, rep_id, created_at"),
    db.from("orgs").select("id, name"),
    db.from("orders").select("business_id, total, created_at, status").neq("status", "voided"),
  ]);

  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, (o.name as string) || "—"]));
  const locByOrg = new Map<string, number>();
  for (const b of biz ?? []) {
    const k = (b.org_id as string | null) ?? "";
    locByOrg.set(k, (locByOrg.get(k) ?? 0) + 1);
  }

  const since30 = Date.now() - 30 * 86400000;
  const lastById = new Map<string, string>();
  const vol30ById = new Map<string, number>();
  for (const o of orders ?? []) {
    const bid = o.business_id as string;
    const at = o.created_at as string;
    if (!lastById.has(bid) || at > (lastById.get(bid) as string)) lastById.set(bid, at);
    if (new Date(at).getTime() >= since30) vol30ById.set(bid, (vol30ById.get(bid) ?? 0) + (Number(o.total) || 0));
  }

  return (biz ?? [])
    .map((b) => ({
      id: b.id as string,
      name: (b.name as string) || "—",
      orgName: orgName.get((b.org_id as string | null) ?? "") ?? "—",
      industry: (b.industry as string) || "—",
      isDemo: (b.is_demo as boolean) === true,
      status: deriveStatus(b.access_status as string | null, b.finix_merchant_state as string | null),
      plan: (b.plan as string | null) ?? null,
      customMrr: (b.custom_mrr as number | null) ?? null,
      repId: (b.rep_id as string | null) ?? null,
      locationCount: locByOrg.get((b.org_id as string | null) ?? "") ?? 1,
      finixMerchantId: (b.finix_merchant_id as string | null) ?? null,
      finixState: (b.finix_merchant_state as string | null) ?? null,
      createdAt: (b.created_at as string) ?? "",
      lastOrderAt: lastById.get(b.id as string) ?? null,
      vol30d: r2(vol30ById.get(b.id as string) ?? 0),
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export type MerchantMember = { userId: string; email: string; role: string };
export type MerchantDetail = {
  merchant: MerchantRow;
  members: MerchantMember[];
  recentOrders: { id: string; total: number; status: string; createdAt: string; channel: string | null }[];
  reps: { id: string; name: string }[];
};

export async function getMerchant(db: AdminDb, id: string): Promise<MerchantDetail | null> {
  const all = await listMerchants(db);
  const merchant = all.find((m) => m.id === id);
  if (!merchant) return null;

  const { data: memberRows } = await db.from("business_members").select("user_id, role").eq("business_id", id);
  const members: MerchantMember[] = [];
  for (const m of memberRows ?? []) {
    let email = "";
    try {
      const { data } = await db.auth.admin.getUserById(m.user_id as string);
      email = data.user?.email ?? "";
    } catch { /* best-effort */ }
    members.push({ userId: m.user_id as string, email, role: (m.role as string) || "—" });
  }

  const ordersQ = (cols: string) =>
    db.from("orders").select(cols).eq("business_id", id).order("created_at", { ascending: false }).limit(10);
  const withCh = await ordersQ("id, total, status, created_at, channel");
  const recent = (withCh.error ? (await ordersQ("id, total, status, created_at")).data : withCh.data) as Record<string, unknown>[] | null;
  const recentOrders = (recent ?? []).map((o) => ({
    id: o.id as string,
    total: Number(o.total) || 0,
    status: (o.status as string) || "—",
    createdAt: (o.created_at as string) ?? "",
    channel: (o.channel as string | null) ?? null,
  }));

  const { data: repRows } = await db.from("reps").select("id, name").eq("status", "active").order("name");
  const reps = (repRows ?? []).map((r) => ({ id: r.id as string, name: (r.name as string) || "—" }));

  return { merchant, members, recentOrders, reps };
}
