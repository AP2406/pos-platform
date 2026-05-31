import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { DriverDialog } from "./driver-dialog";
import { PageHeader, EmptyState } from "../_components/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DriverRow = any;

export default async function DriversPage() {
  await requireBusiness();
  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .order("name");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Drivers"
        subtitle="Your chauffeurs — manage them here, then assign them to trips."
        action={<DriverDialog mode="create" />}
      />

      {!drivers || drivers.length === 0 ? (
        <EmptyState
          title="No drivers yet"
          message="Add your first driver. You'll be able to assign them to trips."
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {drivers.map((d: DriverRow) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-4 p-4"
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
              <DriverDialog mode="edit" driver={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}