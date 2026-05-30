"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateCustomerNotes } from "./customer-actions";

export function CustomerNotes({
  customerId,
  initialNotes,
}: {
  customerId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const hasChanges = notes !== savedNotes;

  function handleSave() {
    setError(null);
    setJustSaved(false);
    startTransition(async () => {
      const result = await updateCustomerNotes({
        customerId,
        notes,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSavedNotes(notes);
        setJustSaved(true);
        router.refresh();
        setTimeout(() => setJustSaved(false), 2000);
      }
    });
  }

  function handleCancel() {
    setNotes(savedNotes);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any notes about this customer — preferences, allergies, VIP status, payment quirks, etc."
        rows={4}
        maxLength={5000}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground resize-y min-h-[100px]"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground tabular-nums">
          {notes.length} / 5000
        </div>
        <div className="flex items-center gap-2">
          {justSaved && (
            <span className="text-xs text-green-700">✓ Saved</span>
          )}
          {hasChanges && !isPending && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isPending}
          >
            {isPending ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}