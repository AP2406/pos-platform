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
import { createCustomer, updateCustomer } from "./actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExistingCustomer = any;

export function AddCustomerSheet({
  existingCustomer,
  trigger,
}: {
  existingCustomer?: ExistingCustomer;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEditMode = !!existingCustomer;
  const [open, setOpen] = useState(false);

  const [name, setName] = useState<string>(existingCustomer?.name ?? "");
  const [phone, setPhone] = useState<string>(existingCustomer?.phone ?? "");
  const [email, setEmail] = useState<string>(existingCustomer?.email ?? "");
  const [notes, setNotes] = useState<string>(existingCustomer?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    if (isEditMode) return;
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
      };

      const result = isEditMode
        ? await updateCustomer(existingCustomer.id, payload)
        : await createCustomer(payload);

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
        {trigger ?? <Button>+ Add customer</Button>}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>
              {isEditMode ? "Edit customer" : "Add customer"}
            </SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update customer details."
                : "A person you've worked with."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-2 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mike Chen"
                autoFocus
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
                placeholder="mike@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Prefers SUV, often books early morning"
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
                : "Add customer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}