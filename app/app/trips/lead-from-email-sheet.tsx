"use client";

import { useState, useTransition } from "react";
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
import { parseLeadEmail, createTripFromLead } from "./lead-from-email-actions";
import { useVocab } from "../_components/vocab-provider";


function isoToLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function LeadFromEmailSheet() {
  const router = useRouter();
  const vocab = useVocab();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"paste" | "review">("paste");

  const [emailBody, setEmailBody] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, startParseTransition] = useTransition();

  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [pickup, setPickup] = useState<string>("");
  const [dropoff, setDropoff] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [priceTotal, setPriceTotal] = useState<string>("");
  const [passengerCount, setPassengerCount] = useState<string>("");
  const [luggageCount, setLuggageCount] = useState<string>("");
  const [flightNumber, setFlightNumber] = useState<string>("");
  const [terminal, setTerminal] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  function reset() {
    setStage("paste");
    setEmailBody("");
    setParseError(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setPickup("");
    setDropoff("");
    setScheduledAt("");
    setPriceTotal("");
    setPassengerCount("");
    setLuggageCount("");
    setFlightNumber("");
    setTerminal("");
    setNotes("");
    setSubmitError(null);
  }

  async function handleParse() {
    setParseError(null);
    if (!emailBody.trim()) {
      setParseError("Please paste the email content first.");
      return;
    }
    startParseTransition(async () => {
      const result = await parseLeadEmail(emailBody);
      if ("error" in result) {
        setParseError(result.error);
        return;
      }
      const data = result.data;
      setCustomerName(data.customer_name ?? "");
      setCustomerPhone(data.customer_phone ?? "");
      setCustomerEmail(data.customer_email ?? "");
      setPickup(data.pickup_address ?? "");
      setDropoff(data.dropoff_address ?? "");
      setScheduledAt(isoToLocalDateTime(data.scheduled_at));
      setPriceTotal(data.price_total != null ? String(data.price_total) : "");
      setPassengerCount(data.passenger_count != null ? String(data.passenger_count) : "");
      setLuggageCount(data.luggage_count != null ? String(data.luggage_count) : "");
      setFlightNumber(data.flight_number ?? "");
      setTerminal(data.terminal ?? "");
      setNotes(data.notes ?? "");
      setStage("review");
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!pickup.trim() || !dropoff.trim() || !scheduledAt || !priceTotal) {
      setSubmitError("Pickup, dropoff, date/time, and price are required.");
      return;
    }

    startSubmitTransition(async () => {
      const result = await createTripFromLead({
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        pickup_address: pickup,
        dropoff_address: dropoff,
        scheduled_at: new Date(scheduledAt).toISOString(),
        price_total: parseFloat(priceTotal),
        passenger_count: passengerCount ? parseInt(passengerCount, 10) : null,
        luggage_count: luggageCount ? parseInt(luggageCount, 10) : null,
        flight_number: flightNumber.trim() || null,
        terminal: terminal.trim() || null,
        notes: notes.trim() || null,
      });

      if ("error" in result) {
        setSubmitError(result.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline">✨ Lead from email</Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>New lead from email</SheetTitle>
            <SheetDescription>
              {stage === "paste"
                ? "Paste a booking email and AI will fill in the details."
                : "Review the AI extraction and edit anything wrong."}
            </SheetDescription>
          </SheetHeader>

          {stage === "paste" && (
            <div className="flex-1 space-y-4 px-4 py-2 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="email-body">Email content</Label>
                <Textarea
                  id="email-body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Paste the full booking email here..."
                  rows={14}
                  autoFocus
                />
              </div>
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              <p className="text-xs text-slate-500">
                Tip: paste the full email body including sender info, addresses, and any reference numbers. The AI will pick out what it needs.
              </p>
            </div>
          )}

          {stage === "review" && (
            <div className="flex-1 space-y-4 px-4 py-2 overflow-y-auto">
              <button
                type="button"
                onClick={() => setStage("paste")}
                className="text-xs text-slate-600 underline hover:text-slate-900"
              >
                Back to email
              </button>

              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Customer
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-name" className="text-xs">Name</Label>
                  <Input
                    id="lead-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="lead-phone" className="text-xs">Phone</Label>
                    <Input
                      id="lead-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lead-email" className="text-xs">Email</Label>
                    <Input
                      id="lead-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Email"
                    />
                  </div>
                </div>
                {customerName && (
                  <p className="text-xs text-slate-500">
                    A new customer will be created (or matched if phone/email already exists).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-pickup">
                  Pickup <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lead-pickup"
                  required
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Pickup address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-dropoff">
                  Dropoff <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lead-dropoff"
                  required
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Dropoff address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-when">
                  Date and time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lead-when"
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-price">
                  Price <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">$</span>
                  <Input
                    id="lead-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={priceTotal}
                    onChange={(e) => setPriceTotal(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <Label>{vocab.job_singular + " details"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="lead-passengers" className="text-xs text-slate-500">
                      Passengers
                    </Label>
                    <Input
                      id="lead-passengers"
                      type="number"
                      min="0"
                      max="100"
                      value={passengerCount}
                      onChange={(e) => setPassengerCount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lead-luggage" className="text-xs text-slate-500">
                      Luggage
                    </Label>
                    <Input
                      id="lead-luggage"
                      type="number"
                      min="0"
                      max="50"
                      value={luggageCount}
                      onChange={(e) => setLuggageCount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lead-flight" className="text-xs text-slate-500">
                      Flight
                    </Label>
                    <Input
                      id="lead-flight"
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lead-terminal" className="text-xs text-slate-500">
                      Terminal
                    </Label>
                    <Input
                      id="lead-terminal"
                      value={terminal}
                      onChange={(e) => setTerminal(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <Label htmlFor="lead-notes">Notes</Label>
                <Textarea
                  id="lead-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            </div>
          )}

          <SheetFooter className="gap-2 flex-row">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            {stage === "paste" ? (
              <Button
                type="button"
                className="flex-1"
                disabled={isParsing || !emailBody.trim()}
                onClick={handleParse}
              >
                {isParsing ? "Parsing..." : "Parse with AI"}
              </Button>
            ) : (
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || !pickup.trim() || !dropoff.trim() || !scheduledAt || !priceTotal}
              >
                {isSubmitting ? "Creating..." : "Create " + vocab.job_singular.toLowerCase()}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}