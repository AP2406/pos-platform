import { requireBusiness } from "@/lib/services/tenancy";
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
  // Gated to businesses that actually use POS so the transportation vertical's
  // sidebar is untouched.
  const hasPos = nav.some((n) => n.href === "/app/pos");
  const extras: { href: string; label: string }[] = [];
  if (hasPos) {
    extras.push({ href: "/app/reports", label: "Reports" });
    if (role === "owner" || role === "manager") {
      extras.push({ href: "/app/audit", label: "Activity log" });
    }
  }
  const finalNav = [...nav, ...extras];

  const vocab = getVocab(businessConfig);
  const fields = getFields(businessConfig);

  return (
    <VocabProvider vocab={vocab} fields={fields}>
      <AppShell
        businessName={business.name}
        industry={business.industry}
        role={role}
        nav={finalNav}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </VocabProvider>
  );
}