import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { DriverDialog } from "./driver-dialog";
import { PageHeader, EmptyState } from "../_components/ui";
import { getVocab } from "@/lib/modules/resolve";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DriverRow = any;

export default async function DriversPage() {
  const { business } = await requireBusiness();
  requireModule(business, "/app/drivers");
  const vocab = getVocab(business.industry);
  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .order("name");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={vocab.resource_plural}
        subtitle={"Manage your " + vocab.resource_plural.toLowerCase() + " here, then assign them to " + vocab.job_plural.toLowerCase() + "."}
        action={<DriverDialog mode="create" />}
      />

      {!drivers || drivers.length === 0 ? (
        <EmptyState
          title={"No " + vocab.resource_plural.toLowerCase() + " yet"}
          message={"Add your first " + vocab.resource_singular.toLowerCase() + ". You'll be able to assign them to " + vocab.job_plural.toLowerCase() + "."}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {drivers.map((d: DriverRow) => (
            <Link
              key={d.id}
              href={"/app/drivers/" + d.id}
              className="flex items-center justify-between gap-4 p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                  {(d.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {d.name}
                    {d.status === "inactive" && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                    {d.phone && <span>{d.phone}</span>}
                    {d.email && <span>{d.email}</span>}
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-muted-foreground shrink-0">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}