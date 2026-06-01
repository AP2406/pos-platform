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

  const vocab = getVocab(businessConfig);
  const fields = getFields(businessConfig);

  return (
    <VocabProvider vocab={vocab} fields={fields}>
      <AppShell
        businessName={business.name}
        industry={business.industry}
        role={role}
        nav={nav}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </VocabProvider>
  );
}