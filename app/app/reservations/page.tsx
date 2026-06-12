import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { listReservations } from "./reservation-actions";
import { listAssignableTables } from "../pos/sections-actions";
import { ReservationsClient } from "./reservations-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { business } = await requireBusiness();
  if (!hasFloorService(business)) redirect("/app");

  const [reservations, tables] = await Promise.all([listReservations(), listAssignableTables()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bookings and the walk-in waitlist. Seat a party to a table when they arrive.
        </p>
      </div>
      <ReservationsClient
        initial={reservations}
        tables={tables.map((t) => ({ id: t.id, label: t.label }))}
      />
    </div>
  );
}
