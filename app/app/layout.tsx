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

  const nav = resolveNav({
    industry: business.industry,
    driversEnabled: business.drivers_enabled,
  }).map((item) => ({ href: item.href, label: item.label }));

  const vocab = getVocab(business.industry);
  const fields = getFields(business.industry);

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