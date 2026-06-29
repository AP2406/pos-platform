import { createAdminClient } from "@/lib/supabase/admin";

type AdminDb = ReturnType<typeof createAdminClient>;

export type Application = {
  id: string;
  businessName: string;
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  industry: string | null;
  plan: string | null;
  referredByRep: string | null;
  status: string;
  notes: string | null;
  finixMerchantId: string | null;
  provisionedBusinessId: string | null;
  createdAt: string;
};

function map(r: Record<string, unknown>): Application {
  return {
    id: r.id as string,
    businessName: (r.business_name as string) || "—",
    contactName: (r.contact_name as string | null) ?? null,
    contactEmail: (r.contact_email as string) || "—",
    contactPhone: (r.contact_phone as string | null) ?? null,
    industry: (r.industry as string | null) ?? null,
    plan: (r.plan as string | null) ?? null,
    referredByRep: (r.referred_by_rep as string | null) ?? null,
    status: (r.status as string) || "new",
    notes: (r.notes as string | null) ?? null,
    finixMerchantId: (r.finix_merchant_id as string | null) ?? null,
    provisionedBusinessId: (r.provisioned_business_id as string | null) ?? null,
    createdAt: (r.created_at as string) ?? "",
  };
}

export async function listApplications(db: AdminDb): Promise<Application[]> {
  const { data } = await db.from("merchant_applications").select("*").order("created_at", { ascending: false });
  return (data ?? []).map((r) => map(r as Record<string, unknown>));
}

export async function getApplication(db: AdminDb, id: string): Promise<Application | null> {
  const { data } = await db.from("merchant_applications").select("*").eq("id", id).maybeSingle();
  return data ? map(data as Record<string, unknown>) : null;
}
