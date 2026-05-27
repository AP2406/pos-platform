import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddPartnerSheet } from "./add-partner-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PartnerRow = any;

export default async function PartnersPage() {
  await requireBusiness();
  const supabase = await createClient();

  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("name");

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Partners</h1>
          <p className="text-slate-500 text-sm mt-1">
            Drivers and services you farm trips out to.
          </p>
        </div>
        <AddPartnerSheet />
      </div>

      {!partners || partners.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <h2 className="font-medium text-slate-900">No partners yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Add a partner you farm trips out to. You&apos;ll set a default
            cookie they pay you.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {partners.map((p: PartnerRow) => {
            let defaultRate = "—";
            if (p.default_cookie_percent != null) {
              defaultRate = `${p.default_cookie_percent}%`;
            } else if (p.default_cookie_flat != null) {
              defaultRate = `$${p.default_cookie_flat}`;
            }
            return (
              <Link
                key={p.id}
                href={`/app/partners/${p.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-1 space-x-3">
                    {p.contact_name && <span>{p.contact_name}</span>}
                    {p.phone && <span>{p.phone}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Default cookie</div>
                  <div className="font-medium text-sm">{defaultRate}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}