import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import TokenizedChargeForm from "./form";

export const dynamic = "force-dynamic";

export default async function TokenizedChargePage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id")
    .eq("id", business.id)
    .single();

  const applicationId = process.env.FINIX_APPLICATION_ID || "";
  const environment = process.env.FINIX_ENVIRONMENT === "live" ? "live" : "sandbox";
  const merchantId = biz && biz.finix_merchant_id ? (biz.finix_merchant_id as string) : null;

  return (
    <TokenizedChargeForm
      applicationId={applicationId}
      environment={environment}
      merchantId={merchantId}
    />
  );
}