import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TripControls } from "./trip-controls";
import { BookTripSheet } from "../book-trip-sheet";
import { Button } from "@/components/ui/button";
import { getSquareDashboardUrl } from "@/lib/services/square";
import { StatusBadge, SectionHeader } from "../../_components/ui";
import { SendInvoiceButton } from "./send-invoice-button";
import { SendReceiptButton } from "./send-receipt-button";
import { LineItemsSection } from "./line-items";
import { CreateInvoiceButton } from "./create-invoice-button";
import { UpdateFromConversation } from "./update-from-conversation";
import { AssignDriver } from "../../drivers/assign-driver";
import { getVocab, getFields } from "@/lib/modules/resolve";
import { readFieldValue } from "@/lib/modules/field-utils";

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

function invoiceStatusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-secondary text-secondary-foreground",
    UNPAID: "bg-amber-50 text-amber-700",
    SCHEDULED: "bg-blue-50 text-blue-700",
    PARTIALLY_PAID: "bg-amber-50 text-amber-700",
    PAID: "bg-green-50 text-green-700",
    PAYMENT_PENDING: "bg-amber-50 text-amber-700",
    CANCELED: "bg-red-50 text-red-700",
    FAILED: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-secondary text-secondary-foreground";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripDetail = any;

type LineItemRow = {
  id: string;
  name: string;
  amount: string;
  quantity: number;
  category: string | null;
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();
  requireModule(business, "/app/trips");
  const vocab = getVocab(business.industry);
  const supabase = await createClient();

  const [
    tripResult,
    customersResult,
    vehiclesResult,
    partnersResult,
    lineItemsResult,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "*, customer:customers(id, name, email), vehicle:vehicles(id, name), partner:partners(id, name)"
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
    supabase
      .from("trip_line_items")
      .select("id, name, amount, quantity, category")
      .eq("trip_id", id)
      .order("created_at"),
  ]);

  if (!tripResult.data) notFound();
  const trip: TripDetail = tripResult.data;

  const hasDetails =
    trip.passenger_count != null ||
    trip.luggage_count != null ||
    trip.flight_number ||
    trip.terminal ||
    trip.vehicle?.name;

  const tripPrice = parseFloat(trip.price_total);
  const tipAmount = trip.tip_amount ? parseFloat(trip.tip_amount) : 0;
  const refundAmount = trip.refund_amount ? parseFloat(trip.refund_amount) : 0;
  const isRefunded = trip.refund_status === "completed";

  // Line items
  const lineItems = ((lineItemsResult.data ?? []) as LineItemRow[]).map(
    (item) => ({
      id: item.id,
      name: item.name,
      amount: parseFloat(item.amount),
      quantity: item.quantity,
      category: item.category,
    })
  );
  const addOnsSubtotal = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );

  // Invoice math
  const subtotal = tripPrice + addOnsSubtotal + tipAmount;
  const totalPaid = subtotal - refundAmount;

  const canEditLineItems = !isRefunded;
  const customerEmail = Array.isArray(trip.customer)
    ? trip.customer[0]?.email ?? null
    : (trip.customer as { email?: string } | null)?.email ?? null;

  return (
    <div className="max-w-3xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/trips"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All {vocab.job_plural.toLowerCase()}
        </Link>
        <BookTripSheet
          customers={customersResult.data ?? []}
          vehicles={vehiclesResult.data ?? []}
          partners={partnersResult.data ?? []}
          existingTrip={trip}
          jobSingular={vocab.job_singular}
          trigger={
            <Button variant="outline" size="sm">
              {"Edit " + vocab.job_singular.toLowerCase()}
            </Button>
          }
        />
      </div>

      {/* Trip header */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {trip.customer?.name ?? "One-off " + vocab.job_singular.toLowerCase()}
            </h1>
            {trip.customer?.email && (
              <div className="text-sm text-muted-foreground mt-0.5">
                {trip.customer.email}
              </div>
            )}
          </div>
          <StatusBadge status={trip.trip_status} />
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Pickup
            </div>
            <div className="font-medium">{trip.pickup_address}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Dropoff
            </div>
            <div className="font-medium">{trip.dropoff_address}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              When
            </div>
            <div className="font-medium">
              {formatDateTime(trip.scheduled_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Trip details */}
      {hasDetails && (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>{vocab.job_singular + " details"}</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {getFields(business.industry)
              .filter((f) => f.section === "Details")
              .map((f) => {
                const v = readFieldValue(trip, f);
                if (v == null || v === "") return null;
                return (
                  <div key={f.key}>
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="font-medium tabular-nums">{String(v)}</div>
                  </div>
                );
              })}
            {trip.vehicle?.name && (
              <div>
                <div className="text-xs text-muted-foreground">{vocab.asset_singular}</div>
                <div className="font-medium">{trip.vehicle.name}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver assignment */}
      {business.drivers_enabled !== false && (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>{vocab.resource_singular}</SectionHeader>
          <p className="text-sm text-muted-foreground mb-3">
      {"Assign a " + vocab.resource_singular.toLowerCase() + " to this " + vocab.job_singular.toLowerCase() + ". Only active " + vocab.resource_plural.toLowerCase() + " appear here."}
          </p>
          <AssignDriver tripId={trip.id} currentDriverId={trip.driver_id ?? null} />
        </div>
      )}

      {/* Update from conversation */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Update from conversation</SectionHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Paste your email thread with the client and let AI fill in the final
          details before you invoice.
        </p>
        <UpdateFromConversation tripId={trip.id} />
      </div>

      {/* Invoice preview — THE HERO CARD */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
          Invoice preview
        </div>

        <div className="flex items-baseline gap-3 mb-6">
          <div className="text-5xl font-semibold tabular-nums tracking-tight">
            ${totalPaid.toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">
            {isRefunded ? "after refund" : trip.payment_collected ? "paid" : "due"}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {/* Base trip line */}
          <div className="flex items-center justify-between py-1.5">
            <div className="text-foreground">
              {trip.pricing_type === "hourly" && trip.hours
                ? vocab.job_singular + " (" + trip.hours + "h hourly)"
                : vocab.job_singular + " (flat rate)"}
            </div>
            <div className="tabular-nums">${tripPrice.toFixed(2)}</div>
          </div>

          {/* Line items */}
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-1.5"
            >
              <div className="text-foreground">
                {item.name}
                {item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ×{item.quantity}
                  </span>
                )}
              </div>
              <div className="tabular-nums">
                ${(item.amount * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}

          {/* Tip */}
          {tipAmount > 0 && (
            <div className="flex items-center justify-between py-1.5">
              <div className="text-foreground">Tip</div>
              <div className="tabular-nums text-green-700">
                ${tipAmount.toFixed(2)}
              </div>
            </div>
          )}

          {/* Subtotal */}
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div className="text-muted-foreground">Subtotal</div>
            <div className="tabular-nums font-medium">
              ${subtotal.toFixed(2)}
            </div>
          </div>

          {/* Refund */}
          {isRefunded && refundAmount > 0 && (
            <div className="flex items-center justify-between py-1.5">
              <div className="text-red-600">Refund</div>
              <div className="tabular-nums text-red-600">
                − ${refundAmount.toFixed(2)}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-border">
            <div className="text-foreground font-semibold">Total</div>
            <div className="tabular-nums font-semibold text-lg">
              ${totalPaid.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Line items editor */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <LineItemsSection
          tripId={trip.id}
          items={lineItems}
          canEdit={canEditLineItems}
        />
      </div>

      {/* Trip status & money */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>
          {trip.handled_by === "partner"
            ? "Farmed out to " + (trip.partner?.name ?? "Unknown")
            : "Driving it myself"}
        </SectionHeader>

        <TripControls
          tripId={trip.id}
          tripPrice={tripPrice}
          tripStatus={trip.trip_status}
          handledBy={trip.handled_by}
          paymentCollected={trip.payment_collected}
          cookieCollected={trip.cookie_collected}
          cookieAmount={
            trip.cookie_amount ? parseFloat(trip.cookie_amount) : null
          }
          tipAmount={tipAmount}
          refundStatus={trip.refund_status ?? null}
          refundAmount={refundAmount > 0 ? refundAmount : null}
          refundReason={trip.refund_reason ?? null}
          refundedAt={trip.refunded_at ?? null}
        />
      </div>

      {/* Customer communication */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Customer communication</SectionHeader>

        <div className="space-y-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
              Invoice
            </div>
            <SendInvoiceButton
              tripId={trip.id}
              customerEmail={customerEmail}
              squareInvoiceUrl={trip.square_invoice_url ?? null}
              brandedInvoiceSentAt={trip.branded_invoice_sent_at ?? null}
            />
          </div>

          <div className="pt-5 border-t border-border">
            <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
              Receipt
            </div>
            <SendReceiptButton
              tripId={trip.id}
              customerEmail={customerEmail}
              tripStatus={trip.trip_status}
              brandedReceiptSentAt={trip.branded_receipt_sent_at ?? null}
            />
          </div>
        </div>
      </div>

      {/* Square invoice status */}
      {trip.square_invoice_id ? (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                  Square invoice
                </h2>
                <span
                  className={"text-xs px-2 py-0.5 rounded-md font-medium " + invoiceStatusColor(trip.square_invoice_status ?? "DRAFT")}
                >
                  {trip.square_invoice_status ?? "DRAFT"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {trip.square_invoice_id}
              </div>
              {trip.square_invoice_status === "DRAFT" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Draft created — review and send from Square.
                </p>
              )}
            </div>
            <Link
              href={getSquareDashboardUrl(trip.square_invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[oklch(0.62_0.215_254)] hover:underline whitespace-nowrap"
            >
              Open in Square →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
                Square invoice
              </h2>
              {trip.square_error ? (
                <p className="text-sm text-red-700">
                  Last attempt failed: {trip.square_error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {"No invoice yet. Once the " + vocab.job_singular.toLowerCase() + " details are final, create a draft in Square, then review and send it from there."}
                </p>
              )}
            </div>
            <CreateInvoiceButton tripId={trip.id} />
          </div>
        </div>
      )}

      {/* Notes */}
      {trip.notes && (
        <div className="bg-card border border-border rounded-lg p-6">
          <SectionHeader>Notes</SectionHeader>
          <p className="text-sm whitespace-pre-wrap">{trip.notes}</p>
        </div>
      )}
    </div>
  );
}