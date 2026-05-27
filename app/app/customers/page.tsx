import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddCustomerSheet } from "./add-customer-sheet";

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">
            People you&apos;ve driven for.
          </p>
        </div>
        <AddCustomerSheet />
      </div>

      {!customers || customers.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <h2 className="font-medium text-slate-900">No customers yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Add your first customer or create one inline when booking a trip.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {customers.map((c: CustomerRow) => (
            <Link
              key={c.id}
              href={`/app/customers/${c.id}`}
              className="flex items-center justify-between p-4 hover:bg-slate-50 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500 mt-1 space-x-3">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}