import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { AddVehicleSheet } from "./add-vehicle-sheet";
import { PageHeader, EmptyState } from "../_components/ui";
import { getVocab } from "@/lib/modules/resolve";

export default async function VehiclesPage() {
  const { business } = await requireBusiness();
  requireModule(business, "/app/vehicles");
  const vocab = getVocab(business.industry);
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={vocab.asset_plural}
        subtitle={"The " + vocab.asset_plural.toLowerCase() + " you use to serve " + vocab.job_plural.toLowerCase() + "."}
        action={<AddVehicleSheet />}
      />

      {!vehicles || vehicles.length === 0 ? (
        <EmptyState
          title={"No " + vocab.asset_plural.toLowerCase() + " yet"}
          message={"Add the " + vocab.asset_plural.toLowerCase() + " you use so you can assign them to " + vocab.job_plural.toLowerCase() + " later."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-card border border-border rounded-lg p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {[
                      v.vehicle_type,
                      v.capacity ? v.capacity + " passengers" : null,
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ") || (
                      <span className="text-muted-foreground/60 italic">
                        No details
                      </span>
                    )}
                  </div>
                  {v.plate && (
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {v.plate}
                    </div>
                  )}
                </div>
                <span
                  className={
                    "text-xs px-2 py-0.5 rounded-md font-medium shrink-0 " +
                    (v.is_active
                      ? "bg-green-50 text-green-700"
                      : "bg-secondary text-muted-foreground")
                  }
                >
                  {v.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}