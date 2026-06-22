import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddCustomerSheet } from "./add-customer-sheet";
import { PageHeader, EmptyState } from "../_components/ui";
import { ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomerRow = any;

export default async function CustomersPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  const canSeeInsights = (role === "owner" || role === "manager") && business.industry !== "transportation";

  // Industry-aware copy: the transportation tenant keeps its wording; restaurant
  // (and any other vertical) gets neutral/hospitality copy.
  const isTransport = business.industry === "transportation";
  const subtitle = isTransport ? "People you've driven for." : "Your regulars.";
  const emptyMessage = isTransport
    ? "Add your first customer or create one inline when booking a trip."
    : "Add your first customer, or create one at the register.";

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Customers"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            {canSeeInsights && (
              <Link href="/app/customers/insights" className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
                Insights
              </Link>
            )}
            <AddCustomerSheet />
          </div>
        }
      />

      {!customers || customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          message={emptyMessage}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {customers.map((c: CustomerRow) => (
            <Link
              key={c.id}
              href={`/app/customers/${c.id}`}
              className="flex items-center justify-between p-4 hover:bg-accent transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-1 space-x-3">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}