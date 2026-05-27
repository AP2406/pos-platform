import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { AddVehicleSheet } from "./add-vehicle-sheet";

export default async function VehiclesPage() {
  await requireBusiness();
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Vehicles</h1>
          <p className="text-slate-500 text-sm mt-1">
            The cars you use to serve trips.
          </p>
        </div>
        <AddVehicleSheet />
      </div>

      {!vehicles || vehicles.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <h2 className="font-medium text-slate-900">No vehicles yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Add the cars you drive so you can assign them to trips later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-slate-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {[
                      v.vehicle_type,
                      v.capacity ? `${v.capacity} passengers` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || (
                      <span className="text-slate-400 italic">No details</span>
                    )}
                  </div>
                  {v.plate && (
                    <div className="text-xs text-slate-500 mt-1 font-mono">
                      {v.plate}
                    </div>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    v.is_active
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
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