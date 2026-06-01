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
import { DynamicFields } from "../_components/dynamic-fields";
import { useFields } from "../_components/vocab-provider";
import { splitForSave, initialFieldValues } from "@/lib/modules/field-utils";

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
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function toggleBtn(active: boolean, size: "sm" | "xs" = "sm") {
  return (
    "px-3 py-2 " +
    (size === "xs" ? "text-xs" : "text-sm") +
    " rounded-md border transition-colors " +
    (active
      ? "border-foreground bg-accent font-medium"
      : "border-border hover:border-foreground/40 hover:bg-accent/50")
  );
}

export function BookTripSheet({
  customers: initialCustomers,
  vehicles,
  partners,
  existingTrip,
  trigger,
  jobSingular = "Trip",
}: {
  customers: Option[];
  vehicles: Option[];
  partners: Partner[];
  existingTrip?: ExistingTrip;
  trigger?: ReactNode;
  jobSingular?: string;
}) {
  const router = useRouter();
  const isEditMode = !!existingTrip;
  const [open, setOpen] = useState(false);

  const fields = useFields();

  const [customers, setCustomers] = useState<Option[]>(initialCustomers);

  const [customerId, setCustomerId] = useState<string>(
    existingTrip?.customer_id ?? ""
  );
  const [vehicleId, setVehicleId] = useState<string>(
    existingTrip?.vehicle_id ?? ""
  );
  const [detailValues, setDetailValues] = useState<Record<string, string>>(() =>
    initialFieldValues(existingTrip ?? null, fields)
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
  const [notes, setNotes] = useState<string>(existingTrip?.notes ?? "");

  const [handledBy, setHandledBy] = useState<"self" | "partner">(
    existingTrip?.handled_by ?? "self"
  );
  const [partnerId, setPartnerId] = useState<string>(
    existingTrip?.partner_id ?? ""
  );

  const [cookieMode, setCookieMode] = useState<"percent" | "dollar">("dollar");
  const [cookiePercent, setCookiePercent] = useState<string>("");
  const [cookieAmount, setCookieAmount] = useState<string>(
    existingTrip?.cookie_amount ? String(existingTrip.cookie_amount) : ""
  );
  const [cookieManuallySet, setCookieManuallySet] = useState<boolean>(
    isEditMode
  );

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
      cookieHint = "Default: " + selectedPartner.default_cookie_percent + "%";
    } else if (selectedPartner.default_cookie_flat != null) {
      cookieHint = "Default: $" + selectedPartner.default_cookie_flat;
    } else {
      cookieHint = "No default set";
    }
  }

  function handleFieldChange(key: string, value: string) {
    setDetailValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (isEditMode) return;
    setCustomerId("");
    setVehicleId("");
    setDetailValues(initialFieldValues(null, fields));
    setScheduledAt("");
    setPricingType("flat");
    setPriceTotal("");
    setHours("");
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

  const requiredMissing = fields.some(
    (f) => f.required && !(detailValues[f.key] ?? "").trim()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = fields.find(
      (f) => f.required && !(detailValues[f.key] ?? "").trim()
    );
    if (missing) {
      setError("Please fill in " + missing.label.toLowerCase() + ".");
      return;
    }

    if (handledBy === "partner" && !partnerId) {
      setError("Please select a partner.");
      return;
    }

    startTransition(async () => {
      const { columns } = splitForSave(detailValues, fields);
      const payload = {
        customer_id: customerId || null,
        vehicle_id: handledBy === "self" ? vehicleId || null : null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        pricing_type: pricingType,
        price_total: parseFloat(priceTotal),
        hours: pricingType === "hourly" && hours ? parseFloat(hours) : null,
        handled_by: handledBy,
        partner_id: handledBy === "partner" ? partnerId : null,
        cookie_amount:
          handledBy === "partner" && computedCookieDollars > 0
            ? computedCookieDollars
            : null,
        notes,
        ...columns,
      };

      const result = isEditMode
        ? await updateTrip(existingTrip.id, payload as Parameters<typeof updateTrip>[1])
        : await createTrip(payload as Parameters<typeof createTrip>[0]);

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
    "w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !isEditMode) reset();
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? <Button>{"+ Book " + jobSingular.toLowerCase()}</Button>}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>{isEditMode ? "Edit " + jobSingular.toLowerCase() : "Book " + jobSingular.toLowerCase()}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update the details below and save."
                : "Driving it yourself or farming it out \u2014 both work."}
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
                    className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
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
                <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/50">
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

            {/* VERTICAL FIELDS — ROUTE */}
            <DynamicFields
              fields={fields.filter((f) => f.section === "Route")}
              values={detailValues}
              onChange={handleFieldChange}
            />

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
            <div className="space-y-2 pt-3 border-t border-border">
              <Label>{"Who's handling this " + jobSingular.toLowerCase() + "?"}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  className={toggleBtn(handledBy === "self")}
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
                  className={toggleBtn(handledBy === "partner")}
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
                      <p className="text-xs text-muted-foreground">
                        No partners yet. Add one in Partners first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cookie owed to me</Label>
                      {cookieHint && (
                        <span className="text-xs text-muted-foreground">
                          {cookieHint}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCookieMode("percent");
                          setCookieManuallySet(true);
                        }}
                        className={toggleBtn(cookieMode === "percent", "xs")}
                      >
                        Percentage
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCookieMode("dollar");
                          setCookieManuallySet(true);
                        }}
                        className={toggleBtn(cookieMode === "dollar", "xs")}
                      >
                        Dollar amount
                      </button>
                    </div>

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
                          <span className="text-muted-foreground text-sm">
                            %
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cookie: ${computedCookieDollars.toFixed(2)}
                          {priceTotal &&
                            " of $" + parseFloat(priceTotal).toFixed(2) + " " + jobSingular.toLowerCase()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">
                            $
                          </span>
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
                        <p className="text-xs text-muted-foreground">
                          What the partner pays you for sending them this trip.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* VERTICAL FIELDS — DETAILS */}
            <DynamicFields
              fields={fields.filter((f) => f.section === "Details")}
              values={detailValues}
              onChange={handleFieldChange}
            />

            {/* PRICING */}
            <div className="space-y-2 pt-3 border-t border-border">
              <Label>Pricing</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  className={toggleBtn(pricingType === "flat")}
                  onClick={() => setPricingType("flat")}
                >
                  Flat rate
                </button>
                <button
                  type="button"
                  className={toggleBtn(pricingType === "hourly")}
                  onClick={() => setPricingType("hourly")}
                >
                  Hourly
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <div className="flex-1 space-y-2">
                  <Label
                    htmlFor="price"
                    className="text-xs text-muted-foreground"
                  >
                    Total price
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
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
                    <Label
                      htmlFor="hours"
                      className="text-xs text-muted-foreground"
                    >
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
            <div className="space-y-2 pt-3 border-t border-border">
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
                requiredMissing ||
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
                : "Book " + jobSingular.toLowerCase()}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}