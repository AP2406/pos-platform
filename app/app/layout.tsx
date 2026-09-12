import { requireBusiness, listBusinesses, requireUser } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./_components/app-shell";
import { AssistantWidget } from "./_components/assistant-widget";
import { VocabProvider } from "./_components/vocab-provider";
import { resolveNav, getVocab, getFields } from "@/lib/modules/resolve";
import { buildNav } from "@/lib/modules/nav";
import {
  canAccess,
  roleKeyForWebRole,
  WEB_ROLE_LABELS,
  type WebRole,
} from "@/lib/services/route-access";
import { hasFloorService } from "@/lib/modules/modes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, role } = await requireBusiness();
  const businesses = await listBusinesses();

  // The top bar's user chip shows the person, not a placeholder. Supabase puts
  // whatever the account set at sign-up in user_metadata; when that's empty the
  // address they sign in with is the truest name we hold, so it is what shows.
  const user = await requireUser();
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const userName =
    (meta.full_name || meta.name || "").trim() || user.email || "Signed in";

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
  //
  // This used to read `systemRoleForLegacy(role)`, which maps the *staff* role
  // enum (owner|manager|staff|trainee) onto a matrix key. Passing a
  // business_members role through it worked by coincidence for owner/manager
  // and was simply wrong for the rest — and after 0099 it would have collapsed
  // shift_lead and bookkeeper onto "server", so they'd inherit a server's
  // hidden nav. The web role keys now line up with roles.key directly, except
  // for the two legacy names.
  let hiddenNav: string[] = [];
  try {
    const navClient = await createClient();
    const { data: roleRow } = await navClient
      .from("roles")
      .select("hidden_nav")
      .eq("business_id", business.id)
      .eq("key", roleKeyForWebRole(role))
      .maybeSingle();
    if (roleRow && Array.isArray((roleRow as { hidden_nav?: unknown }).hidden_nav)) {
      hiddenNav = (roleRow as { hidden_nav: unknown[] }).hidden_nav as string[];
    }
  } catch { /* pre-0070 or no role row — show everything */ }

  // Reaches into the second level too. Every href the role editor offers
  // (lib/nav-modules.ts) is a secondary destination, so before the rail nested
  // them this filter happened to see all of them at depth 1 — after nesting, a
  // top-level-only filter would silently stop hiding anything.
  //
  // Hiding a PRIMARY must not take its children with it, either: the role
  // editor hides one destination, and each child is a destination in its own
  // right, so survivors are promoted into the hidden parent's slot — the same
  // rule buildNav() uses when a parent fails the permission filter.
  type NavItems = typeof sections[number]["items"];
  const hide = (items: NavItems): NavItems => {
    const out: NavItems = [];
    for (const item of items) {
      const kids = item.children ? hide(item.children) : undefined;
      if (hiddenNav.includes(item.href)) {
        if (kids) out.push(...kids);
        continue;
      }
      out.push(kids ? { ...item, children: kids } : item);
    }
    return out;
  };

  const finalNav = hiddenNav.length
    ? sections
        .map((s) => ({ ...s, items: hide(s.items) }))
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
        roleLabel={WEB_ROLE_LABELS[role as WebRole] ?? "Member"}
        userName={userName}
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