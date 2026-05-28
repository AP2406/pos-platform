import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddPartnerSheet } from "./add-partner-sheet";
import { PageHeader, EmptyState } from "../_components/ui";

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
      <PageHeader
        title="Partners"
        subtitle="Drivers and services you farm trips out to."
        action={<AddPartnerSheet />}
      />

      {!partners || partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          message="Add a partner you farm trips out to. You'll set a default cookie they pay you."
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
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
                className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-3">
                    {p.contact_name && <span>{p.contact_name}</span>}
                    {p.phone && <span>{p.phone}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">
                    Default cookie
                  </div>
                  <div className="font-medium text-sm tabular-nums">
                    {defaultRate}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}