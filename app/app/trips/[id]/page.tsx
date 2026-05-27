import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TripControls } from "./trip-controls";
import { BookTripSheet } from "../book-trip-sheet";
import { Button } from "@/components/ui/button";
import { getSquareDashboardUrl } from "@/lib/services/square";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusLabel(status: string) {
  return status.replace("_", " ");
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    booked: "bg-slate-100 text-slate-700",
    confirmed: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
    no_show: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

function invoiceStatusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    UNPAID: "bg-amber-50 text-amber-700",
    SCHEDULED: "bg-blue-50 text-blue-700",
    PARTIALLY_PAID: "bg-amber-50 text-amber-700",
    PAID: "bg-green-50 text-green-700",
    PAYMENT_PENDING: "bg-amber-50 text-amber-700",
    CANCELED: "bg-red-50 text-red-700",
    FAILED: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripDetail = any;

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireBusiness();
  const supabase = await createClient();

  const [tripResult, customersResult, vehiclesResult, partnersResult] =
    await Promise.all([
      supabase
        .from("trips")
        .select(
          `
          *,
          customer:customers(id, name, email),
          vehicle:vehicles(id, name),
          partner:partners(id, name)
        `
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("customers").select("id, name").order("name"),
      supabase
        .from("vehicles")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("partners")
        .select("id, name, default_cookie_percent, default_cookie_flat")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (!tripResult.data) notFound();
  const trip: TripDetail = tripResult.data;

  const hasDetails =
    trip.passenger_count != null ||
    trip.luggage_count != null ||
    trip.flight_number ||
    trip.terminal ||
    trip.vehicle?.name;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/trips"
          className="text-sm text-slate-500 hover:text-slate-900 inline-block"
        >
          ← All trips
        </Link>
        <BookTripSheet
          customers={customersResult.data ?? []}
          vehicles={vehiclesResult.data ?? []}
          partners={partnersResult.data ?? []}
          existingTrip={trip}
          trigger={
            <Button variant="outline" size="sm">
              Edit trip
            </Button>
          }
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {trip.customer?.name ?? "One-off trip"}
            </h1>
            {trip.customer?.email && (
              <div className="text-sm text-slate-500">
                {trip.customer.email}
              </div>
            )}
          </div>
          <span
            className={`text-sm px-3 py-1 rounded capitalize ${statusColor(
              trip.trip_status
            )}`}
          >
            {statusLabel(trip.trip_status)}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Pickup
            </div>
            <div className="font-medium">{trip.pickup_address}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Dropoff
            </div>
            <div className="font-medium">{trip.dropoff_address}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              When
            </div>
            <div className="font-medium">
              {formatDateTime(trip.scheduled_at)}
            </div>
          </div>
        </div>
      </div>

      {hasDetails && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Trip details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {trip.passenger_count != null && (
              <div>
                <div className="text-xs text-slate-500">Passengers</div>
                <div className="font-medium">{trip.passenger_count}</div>
              </div>
            )}
            {trip.luggage_count != null && (
              <div>
                <div className="text-xs text-slate-500">Luggage</div>
                <div className="font-medium">{trip.luggage_count}</div>
              </div>
            )}
            {trip.flight_number && (
              <div>
                <div className="text-xs text-slate-500">Flight</div>
                <div className="font-medium">{trip.flight_number}</div>
              </div>
            )}
            {trip.terminal && (
              <div>
                <div className="text-xs text-slate-500">Terminal</div>
                <div className="font-medium">{trip.terminal}</div>
              </div>
            )}
            {trip.vehicle?.name && (
              <div>
                <div className="text-xs text-slate-500">Vehicle</div>
                <div className="font-medium">{trip.vehicle.name}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-4">
          {trip.handled_by === "partner"
            ? `Farmed out to ${trip.partner?.name ?? "Unknown"}`
            : "Driving it myself"}
        </h2>

        <div className="flex items-baseline gap-3 pb-4 border-b border-slate-100">
          <div className="text-3xl font-semibold">
            ${parseFloat(trip.price_total).toFixed(2)}
          </div>
          <div className="text-sm text-slate-500">
            {trip.pricing_type === "hourly" && trip.hours
              ? `${trip.hours}h hourly`
              : "flat rate"}
          </div>
        </div>

        <div className="pt-4">
          <TripControls
            tripId={trip.id}
            tripStatus={trip.trip_status}
            handledBy={trip.handled_by}
            paymentCollected={trip.payment_collected}
            cookieCollected={trip.cookie_collected}
            cookieAmount={
              trip.cookie_amount ? parseFloat(trip.cookie_amount) : null
            }
          />
        </div>
      </div>

      {trip.square_invoice_id ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs uppercase tracking-wider text-slate-500">
                  Square invoice
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${invoiceStatusColor(
                    trip.square_invoice_status ?? "DRAFT"
                  )}`}
                >
                  {trip.square_invoice_status ?? "DRAFT"}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {trip.square_invoice_id}
              </div>
              {trip.square_invoice_status === "DRAFT" && (
                <p className="text-xs text-slate-500 mt-2">
                  Draft created — click below to review and send from Square.
                </p>
              )}
            </div>
            <Link
              href={getSquareDashboardUrl(trip.square_invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline whitespace-nowrap"
            >
              Open in Square →
            </Link>
          </div>
        </div>
      ) : trip.square_error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
          <div className="text-xs uppercase tracking-wider text-red-700 mb-1">
            Square invoice failed
          </div>
          <div className="text-sm text-red-700">{trip.square_error}</div>
          <div className="text-xs text-red-600 mt-2">
            The trip is saved. You can create the invoice manually in Square for now.
          </div>
        </div>
      ) : null}

      {trip.notes && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap">{trip.notes}</p>
        </div>
      )}
    </div>
  );
}