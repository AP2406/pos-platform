import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./_components/app-shell";
import { AssistantWidget } from "./_components/assistant-widget";
import { VocabProvider } from "./_components/vocab-provider";
import { resolveNav, getVocab, getFields } from "@/lib/modules/resolve";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, role } = await requireBusiness();

  const businessConfig = {
    industry: business.industry,
    config: (business as { config?: unknown }).config,
  };

  const nav = resolveNav({
    ...businessConfig,
    driversEnabled: business.drivers_enabled,
  }).map((item) => ({ href: item.href, label: item.label }));

  // POS-only extras: Reports for everyone, Activity log for owner/manager.
  const hasPos = nav.some((n) => n.href === "/app/pos");
  const extras: { href: string; label: string }[] = [];
  if (hasPos) {
    extras.push({ href: "/app/reports", label: "Reports" });
    if (role === "owner" || role === "manager") {
      extras.push({ href: "/app/audit", label: "Activity log" });
    }
  }
  const finalNav = [...nav, ...extras];

  // Finish-setup nudge: POS businesses that haven't dismissed onboarding and
  // have no real sales yet. Never fires for the transportation vertical.
  let showOnboarding = false;
  const onboarding =
    (business as { onboarding?: { dismissed?: boolean } }).onboarding ?? {};
  if (hasPos && !(onboarding && onboarding.dismissed === true)) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .neq("status", "voided");
    showOnboarding = (count ?? 0) === 0;
  }

  const vocab = getVocab(businessConfig);
  const fields = getFields(businessConfig);

  return (
    <VocabProvider vocab={vocab} fields={fields}>
      <AppShell
        businessName={business.name}
        industry={business.industry}
        role={role}
        nav={finalNav}
        showOnboarding={showOnboarding}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </VocabProvider>
  );
}