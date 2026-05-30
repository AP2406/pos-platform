"use server";

import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const INBOUND_DOMAIN = "inbound.surgetechpos.com";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getInboundAddress(): Promise<{
  address: string;
  verificationCode: string | null;
  verificationAt: string | null;
}> {
  const { business } = await requireBusiness();
  const supabase = serviceClient();

  let { data: row } = await supabase
    .from("import_tokens")
    .select("token, last_verification_code, last_verification_at")
    .eq("business_id", business.id)
    .maybeSingle();

  if (!row) {
    const token = randomBytes(12).toString("hex");
    const { data: inserted } = await supabase
      .from("import_tokens")
      .insert({ business_id: business.id, token: token })
      .select("token, last_verification_code, last_verification_at")
      .single();
    row = inserted;
  }

  return {
    address: "leads-" + (row?.token ?? "") + "@" + INBOUND_DOMAIN,
    verificationCode: row?.last_verification_code ?? null,
    verificationAt: row?.last_verification_at ?? null,
  };
}