import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddCustomerSheet } from "./add-customer-sheet";
import { PageHeader, EmptyState } from "../_components/ui";
import { ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomerRow = any;

export default async function CustomersPage() {
  await requireBusiness();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Customers"
        subtitle="People you've driven for."
        action={<AddCustomerSheet />}
      />

      {!customers || customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          message="Add your first customer or create one inline when booking a trip."
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