import { requireBusiness } from "@/lib/services/tenancy";
import { PageHeader, SectionHeader } from "../_components/ui";

function ExportCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <a href={href} className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 whitespace-nowrap shrink-0">Download CSV</a>
    </div>
  );
}

export default async function ExportsPage() {
  const { role } = await requireBusiness();
  const canExport = role === "owner" || role === "manager";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Export data"
        subtitle="Download your records as CSV. Opens in Excel, Google Sheets, or any accounting tool."
      />

      {!canExport ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <SectionHeader>Export</SectionHeader>
          <p className="text-sm text-muted-foreground">
            Only an owner or manager can export business data.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ExportCard
            title="Sales"
            description="Every non-training sale with totals, status, refunds, and customer."
            href="/api/export/sales"
          />
          <ExportCard
            title="Catalog items"
            description="Your products with price, category, tax, and stock on hand."
            href="/api/export/items"
          />
          <ExportCard
            title="Customers"
            description="Your customer list with contact details."
            href="/api/export/customers"
          />
        </div>
      )}
    </div>
  );
}