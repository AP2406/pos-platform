"use client";

import { useState, useTransition, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { createTrip, updateTrip } from "./actions";
import { createCustomer } from "../customers/actions";

type Option = { id: string; name: string };
type Partner = {
  id: string;
  name: string;
  default_cookie_percent: number | null;
  default_cookie_flat: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExistingTrip = any;

function isoToLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookTripSheet({
  customers: initialCustomers,
  vehicles,
  partners,
  existingTrip,
  trigger,
}: {
  customers: Option[];
  vehicles: Option[];
  partners: Partner[];
  existingTrip?: ExistingTrip;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEditMode = !!existingTrip;
  const [open, setOpen] = useState(false);

  const [customers, setCustomers] = useState<Option[]>(initialCustomers);

  const [customerId, setCustomerId] = useState<string>(
    existingTrip?.customer_id ?? ""
  );
  const [vehicleId, setVehicleId] = useState<string>(
    existingTrip?.vehicle_id ?? ""
  );
  const [pickup, setPickup] = useState<string>(
    existingTrip?.pickup_address ?? ""
  );
  const [dropoff, setDropoff] = useState<string>(
    existingTrip?.dropoff_address ?? ""
  );
  const [scheduledAt, setScheduledAt] = useState<string>(
    existingTrip ? isoToLocalDateTime(existingTrip.scheduled_at) : ""
  );
  const [pricingType, setPricingType] = useState<"flat" | "hourly">(
    existingTrip?.pricing_type ?? "flat"
  );
  const [priceTotal, setPriceTotal] = useState<string>(
    existingTrip ? String(existingTrip.price_total) : ""
  );
  const [hours, setHours] = useState<string>(
    existingTrip?.hours ? String(existingTrip.hours) : ""
  );
  const [passengerCount, setPassengerCount] = useState<string>(
    existingTrip?.passenger_count != null
      ? String(existingTrip.passenger_count)
      : ""
  );
  const [luggageCount, setLuggageCount] = useState<string>(
    existingTrip?.luggage_count != null
      ? String(existingTrip.luggage_count)
      : ""
  );
  const [flightNumber, setFlightNumber] = useState<string>(
    existingTrip?.flight_number ?? ""
  );
  const [terminal, setTerminal] = useState<string>(
    existingTrip?.terminal ?? ""
  );
  const [notes, setNotes] = useState<string>(existingTrip?.notes ?? "");

  const [handledBy, setHandledBy] = useState<"self" | "partner">(
    existingTrip?.handled_by ?? "self"
  );
  const [partnerId, setPartnerId] = useState<string>(
    existingTrip?.partner_id ?? ""
  );

  // Cookie: can be set as percentage or dollar amount
  const [cookieMode, setCookieMode] = useState<"percent" | "dollar">("dollar");
  const [cookiePercent, setCookiePercent] = useState<string>("");
  const [cookieAmount, setCookieAmount] = useState<string>(
    existingTrip?.cookie_amount ? String(existingTrip.cookie_amount) : ""
  );
  const [cookieManuallySet, setCookieManuallySet] = useState<boolean>(
    isEditMode
  );

  // Computed cookie dollar amount based on mode
  const computedCookieDollars = (() => {
    if (cookieMode === "percent") {
      const percent = parseFloat(cookiePercent);
      const price = parseFloat(priceTotal);
      if (isNaN(percent) || isNaN(price)) return 0;
      return (price * percent) / 100;
    }
    return parseFloat(cookieAmount) || 0;
  })();

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Auto-set cookie mode + value when partner changes (unless manually overridden)
  useEffect(() => {
    if (cookieManuallySet) return;
    if (handledBy !== "partner" || !partnerId) return;

    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return;

    if (partner.default_cookie_percent != null) {
      setCookieMode("percent");
      setCookiePercent(String(partner.default_cookie_percent));
    } else if (partner.default_cookie_flat != null) {
      setCookieMode("dollar");
      setCookieAmount(String(partner.default_cookie_flat));
    }
  }, [partnerId, handledBy, cookieManuallySet, partners]);

  const selectedPartner = partners.find((p) => p.id === partnerId);
  let cookieHint = "";
  if (selectedPartner) {
    if (selectedPartner.default_cookie_percent != null) {
      cookieHint = `Default: ${selectedPartner.default_cookie_percent}%`;
    } else if (selectedPartner.default_cookie_flat != null) {
      cookieHint = `Default: $${selectedPartner.default_cookie_flat}`;
    } else {
      cookieHint = "No default set";
    }
  }

  function reset() {
    if (isEditMode) return;
    setCustomerId("");
    setVehicleId("");
    setPickup("");
    setDropoff("");
    setScheduledAt("");
    setPricingType("flat");
    setPriceTotal("");
    setHours("");
    setPassengerCount("");
    setLuggageCount("");
    setFlightNumber("");
    setTerminal("");
    setNotes("");
    setHandledBy("self");
    setPartnerId("");
    setCookieMode("dollar");
    setCookiePercent("");
    setCookieAmount("");
    setCookieManuallySet(false);
    setError(null);
    cancelAddCustomer();
  }

  function cancelAddCustomer() {
    setShowAddCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setCustomerError(null);
  }

  async function handleAddCustomer() {
    setCustomerError(null);
    if (!newCustomerName.trim()) {
      setCustomerError("Name is required.");
      return;
    }
    setAddingCustomer(true);
    const result = await createCustomer({
      name: newCustomerName,
      phone: newCustomerPhone,
      email: newCustomerEmail,
    });
    setAddingCustomer(false);

    if ("error" in result) {
      setCustomerError(result.error);
      return;
    }
    const newCustomer = { id: result.id, name: newCustomerName.trim() };
    setCustomers((prev) =>
      [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name))
    );
    setCustomerId(result.id);
    cancelAddCustomer();
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (handledBy === "partner" && !partnerId) {
      setError("Please select a partner.");
      return;
    }

    startTransition(async () => {
      const payload = {
        customer_id: customerId || null,
        vehicle_id: handledBy === "self" ? vehicleId || null : null,
        pickup_address: pickup,
        dropoff_address: dropoff,
        scheduled_at: new Date(scheduledAt).toISOString(),
        pricing_type: pricingType,
        price_total: parseFloat(priceTotal),
        hours: pricingType === "hourly" && hours ? parseFloat(hours) : null,
        passenger_count: passengerCount ? parseInt(passengerCount, 10) : null,
        luggage_count: luggageCount ? parseInt(luggageCount, 10) : null,
        flight_number: flightNumber,
        terminal: terminal,
        handled_by: handledBy,
        partner_id: handledBy === "partner" ? partnerId : null,
        cookie_amount:
          handledBy === "partner" && computedCookieDollars > 0
            ? computedCookieDollars
            : null,
        notes,
      };

      const result = isEditMode
        ? await updateTrip(existingTrip.id, payload)
        : await createTrip(payload);

      if ("error" in result) {
        setError(result.error);
      } else {
        if (!isEditMode) reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  const selectClass =
    "w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !isEditMode) reset();
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? <Button>+ Book trip</Button>}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>{isEditMode ? "Edit trip" : "Book trip"}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update the details below and save."
                : "Driving it yourself or farming it out — both work."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-2 overflow-y-auto">
            {/* CUSTOMER */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer">Customer</Label>
                {!showAddCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(true)}
                    className="text-xs text-slate-600 underline hover:text-slate-900"
                  >
                    + New customer
                  </button>
                )}
              </div>

              {!showAddCustomer ? (
                <select
                  id="customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">One-off / no customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                  <div className="space-y-1">
                    <Label htmlFor="new-name" className="text-xs">
                      Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="new-name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Mike Chen"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-phone" className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id="new-phone"
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="(416) 555-0142"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-email" className="text-xs">
                      Email
                    </Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="mike@example.com"
                    />
                  </div>
                  {customerError && (
                    <p className="text-xs text-red-600">{customerError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={cancelAddCustomer}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={handleAddCustomer}
                      disabled={addingCustomer || !newCustomerName.trim()}
                    >
                      {addingCustomer ? "Saving..." : "Save customer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* PICKUP / DROPOFF */}
            <div className="space-y-2">
              <Label htmlFor="pickup">
                Pickup address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pickup"
                required
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="123 King St W, Toronto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoff">
                Dropoff address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dropoff"
                required
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="Pearson Airport, Terminal 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled">
                Pickup date & time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduled"
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            {/* HANDLER */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <Label>Who&apos;s handling this trip?</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    handledBy === "self"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  onClick={() => {
                    setHandledBy("self");
                    setPartnerId("");
                    setCookieMode("dollar");
                    setCookiePercent("");
                    setCookieAmount("");
                    setCookieManuallySet(false);
                  }}
                >
                  Me (I&apos;m driving)
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    handledBy === "partner"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  onClick={() => {
                    setHandledBy("partner");
                    setVehicleId("");
                  }}
                >
                  Farm out to partner
                </button>
              </div>

              {handledBy === "self" && (
                <div className="space-y-2 mt-3">
                  <Label htmlFor="vehicle">Vehicle</Label>
                  <select
                    id="vehicle"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Not assigned</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {handledBy === "partner" && (
                <div className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="partner">
                      Partner <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="partner"
                      value={partnerId}
                      onChange={(e) => {
                        setPartnerId(e.target.value);
                        setCookieManuallySet(false);
                      }}
                      className={selectClass}
                      required={handledBy === "partner"}
                    >
                      <option value="">Select partner...</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {partners.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No partners yet. Add one in Partners first.
                      </p>
                    )}
                  </div>

                  {/* Cookie section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cookie owed to me</Label>
                      {cookieHint && (
                        <span className="text-xs text-slate-500">
                          {cookieHint}
                        </span>
                      )}
                    </div>

                    {/* Mode toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCookieMode("percent");
                          setCookieManuallySet(true);
                        }}
                        className={`px-3 py-2 text-xs rounded-md border transition ${
                          cookieMode === "percent"
                            ? "border-slate-900 bg-slate-50 font-medium"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        Percentage
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCookieMode("dollar");
                          setCookieManuallySet(true);
                        }}
                        className={`px-3 py-2 text-xs rounded-md border transition ${
                          cookieMode === "dollar"
                            ? "border-slate-900 bg-slate-50 font-medium"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        Dollar amount
                      </button>
                    </div>

                    {/* Conditional input */}
                    {cookieMode === "percent" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            id="cookie-percent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={cookiePercent}
                            onChange={(e) => {
                              setCookiePercent(e.target.value);
                              setCookieManuallySet(true);
                            }}
                            placeholder="15"
                          />
                          <span className="text-slate-500 text-sm">%</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Cookie: ${computedCookieDollars.toFixed(2)}
                          {priceTotal &&
                            ` of $${parseFloat(priceTotal).toFixed(
                              2
                            )} trip`}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">$</span>
                          <Input
                            id="cookie-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={cookieAmount}
                            onChange={(e) => {
                              setCookieAmount(e.target.value);
                              setCookieManuallySet(true);
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          What the partner pays you for sending them this trip.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TRIP DETAILS */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <Label>Trip details</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label
                    htmlFor="passengers"
                    className="text-xs text-slate-500"
                  >
                    Passengers
                  </Label>
                  <Input
                    id="passengers"
                    type="number"
                    min="0"
                    max="100"
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="luggage" className="text-xs text-slate-500">
                    Luggage
                  </Label>
                  <Input
                    id="luggage"
                    type="number"
                    min="0"
                    max="50"
                    value={luggageCount}
                    onChange={(e) => setLuggageCount(e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flight" className="text-xs text-slate-500">
                    Flight number
                  </Label>
                  <Input
                    id="flight"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="AC123"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="terminal" className="text-xs text-slate-500">
                    Terminal
                  </Label>
                  <Input
                    id="terminal"
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    placeholder="Terminal 1"
                  />
                </div>
              </div>
            </div>

            {/* PRICING */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <Label>Pricing</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    pricingType === "flat"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  onClick={() => setPricingType("flat")}
                >
                  Flat rate
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    pricingType === "hourly"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  onClick={() => setPricingType("hourly")}
                >
                  Hourly
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="price" className="text-xs text-slate-500">
                    Total price
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-sm">$</span>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={priceTotal}
                      onChange={(e) => setPriceTotal(e.target.value)}
                      placeholder="120.00"
                    />
                  </div>
                </div>
                {pricingType === "hourly" && (
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="hours" className="text-xs text-slate-500">
                      Hours
                    </Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="3"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* NOTES */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Customer prefers no chitchat, 2 large bags"
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <SheetFooter className="gap-2 flex-row">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                isPending ||
                !pickup.trim() ||
                !dropoff.trim() ||
                !scheduledAt ||
                !priceTotal ||
                showAddCustomer ||
                (handledBy === "partner" && !partnerId)
              }
            >
              {isPending
                ? isEditMode
                  ? "Saving..."
                  : "Booking..."
                : isEditMode
                ? "Save changes"
                : "Book trip"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}