import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./_components/app-shell";
import { AssistantWidget } from "./_components/assistant-widget";
import { VocabProvider } from "./_components/vocab-provider";
import { resolveNav, getVocab, getFields } from "@/lib/modules/resolve";
import { buildNav } from "@/lib/modules/nav";
import { canAccess } from "@/lib/services/route-access";
import { hasFloorService } from "@/lib/modules/modes";
import { systemRoleForLegacy } from "@/lib/services/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, role } = await requireBusiness();
  const businesses = await listBusinesses();

  const businessConfig = {
    industry: business.industry,
    config: (business as { config?: unknown }).config,
  };

  const hasPos = resolveNav({
    ...businessConfig,
    driversEnabled: business.drivers_enabled,
  }).some((n) => n.href === "/app/pos");

  // Every destination — core modules and the admin screens alike — now comes
  // from buildNav(), grouped and already filtered to what this role can open.
  const sections = buildNav({
    ...businessConfig,
    driversEnabled: business.drivers_enabled,
    floorService: hasFloorService(business),
    hasPos,
    role,
    multiLocation: businesses.length > 1,
  });

  // CUST-1: per-role nav visibility — hide the optional modules this viewer's
  // role marked hidden (core nav is never hide-able). Migration-resilient.
  let hiddenNav: string[] = [];
  try {
    const navClient = await createClient();
    const { data: roleRow } = await navClient
      .from("roles")
      .select("hidden_nav")
      .eq("business_id", business.id)
      .eq("key", systemRoleForLegacy(role))
      .maybeSingle();
    if (roleRow && Array.isArray((roleRow as { hidden_nav?: unknown }).hidden_nav)) {
      hiddenNav = (roleRow as { hidden_nav: unknown[] }).hidden_nav as string[];
    }
  } catch { /* pre-0070 or no role row — show everything */ }

  const finalNav = hiddenNav.length
    ? sections
        .map((s) => ({ ...s, items: s.items.filter((i) => !hiddenNav.includes(i.href)) }))
        .filter((s) => s.items.length > 0)
    : sections;

  let showOnboarding = false;
  const onboarding =
    (business as { onboarding?: { dismissed?: boolean } }).onboarding ?? {};
  const isDemo = (business as { is_demo?: boolean }).is_demo === true;
  if (!isDemo && hasPos && !(onboarding && onboarding.dismissed === true)) {
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
        businesses={businesses}
        activeBusinessId={business.id}
        nav={finalNav}
        canViewRollup={canAccess(role, "access_reports")}
        showOnboarding={showOnboarding}
        isDemo={isDemo}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </VocabProvider>
  );
}