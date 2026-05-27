"use client";

import { useState, useTransition, ReactNode } from "react";
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
import { createPartner, updatePartner } from "./actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExistingPartner = any;

export function AddPartnerSheet({
  existingPartner,
  trigger,
}: {
  existingPartner?: ExistingPartner;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEditMode = !!existingPartner;
  const [open, setOpen] = useState(false);

  const [name, setName] = useState<string>(existingPartner?.name ?? "");
  const [contactName, setContactName] = useState<string>(
    existingPartner?.contact_name ?? ""
  );
  const [phone, setPhone] = useState<string>(existingPartner?.phone ?? "");
  const [email, setEmail] = useState<string>(existingPartner?.email ?? "");
  const [notes, setNotes] = useState<string>(existingPartner?.notes ?? "");

  const initialCookieMode: "none" | "percent" | "dollar" =
    existingPartner?.default_cookie_percent != null
      ? "percent"
      : existingPartner?.default_cookie_flat != null
      ? "dollar"
      : "none";
  const [cookieMode, setCookieMode] = useState<"none" | "percent" | "dollar">(
    initialCookieMode
  );
  const [cookiePercent, setCookiePercent] = useState<string>(
    existingPartner?.default_cookie_percent != null
      ? String(existingPartner.default_cookie_percent)
      : ""
  );
  const [cookieFlat, setCookieFlat] = useState<string>(
    existingPartner?.default_cookie_flat != null
      ? String(existingPartner.default_cookie_flat)
      : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    if (isEditMode) return;
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setCookieMode("none");
    setCookiePercent("");
    setCookieFlat("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let defaultPercent: number | null = null;
    let defaultFlat: number | null = null;
    if (cookieMode === "percent" && cookiePercent) {
      defaultPercent = parseFloat(cookiePercent);
    } else if (cookieMode === "dollar" && cookieFlat) {
      defaultFlat = parseFloat(cookieFlat);
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        contact_name: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        default_cookie_percent: defaultPercent,
        default_cookie_flat: defaultFlat,
        notes: notes.trim(),
      };

      const result = isEditMode
        ? await updatePartner(existingPartner.id, payload)
        : await createPartner(payload);

      if ("error" in result) {
        setError(result.error);
      } else {
        if (!isEditMode) reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !isEditMode) reset();
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? <Button>+ Add partner</Button>}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>
              {isEditMode ? "Edit partner" : "Add partner"}
            </SheetTitle>
            <SheetDescription>
              A driver or service you farm trips out to.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-2 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">
                Business name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John's Limos"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Contact name</Label>
              <Input
                id="contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(416) 555-0142"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            {/* Default cookie */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <Label>Default cookie</Label>
              <p className="text-xs text-slate-500">
                Auto-fills when you farm out a trip to this partner.
              </p>

              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setCookieMode("none")}
                  className={`px-3 py-2 text-xs rounded-md border transition ${
                    cookieMode === "none"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => setCookieMode("percent")}
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
                  onClick={() => setCookieMode("dollar")}
                  className={`px-3 py-2 text-xs rounded-md border transition ${
                    cookieMode === "dollar"
                      ? "border-slate-900 bg-slate-50 font-medium"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  Dollar
                </button>
              </div>

              {cookieMode === "percent" && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={cookiePercent}
                    onChange={(e) => setCookiePercent(e.target.value)}
                    placeholder="15"
                  />
                  <span className="text-slate-500 text-sm">%</span>
                </div>
              )}

              {cookieMode === "dollar" && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-500 text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cookieFlat}
                    onChange={(e) => setCookieFlat(e.target.value)}
                    placeholder="25.00"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specializes in airport runs, available evenings"
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
              disabled={isPending || !name.trim()}
            >
              {isPending
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                ? "Save changes"
                : "Add partner"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}