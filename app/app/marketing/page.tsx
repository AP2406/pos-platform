import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/services/email";
import { isSmsConfigured } from "@/lib/services/sms";
import { MarketingClient } from "./marketing-client";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "manage_settings");

  const supabase = await createClient();
  const { data: tagRows } = await supabase
    .from("tags")
    .select("id, name")
    .eq("business_id", business.id)
    .order("name", { ascending: true });
  const tags = (tagRows ?? []).map((t) => ({ id: t.id as string, name: t.name as string }));

  const { count: consentedCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("marketing_consent", true)
    .not("email", "is", null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Email customers who opted in. Every message includes an unsubscribe link.
        </p>
      </div>
      <MarketingClient
        tags={tags}
        consentedCount={consentedCount ?? 0}
        emailConfigured={isEmailConfigured()}
        smsConfigured={isSmsConfigured()}
      />
    </div>
  );
}
