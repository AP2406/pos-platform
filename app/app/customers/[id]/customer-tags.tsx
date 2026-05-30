"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  createTag,
  attachTagToCustomer,
  detachTagFromCustomer,
} from "./customer-actions";

type Tag = {
  id: string;
  name: string;
  color: string;
};

const COLOR_OPTIONS: { value: string; label: string; classes: string }[] = [
  { value: "gray", label: "Gray", classes: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "red", label: "Red", classes: "bg-red-50 text-red-700 border-red-200" },
  { value: "amber", label: "Amber", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "green", label: "Green", classes: "bg-green-50 text-green-700 border-green-200" },
  { value: "blue", label: "Blue", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "purple", label: "Purple", classes: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "pink", label: "Pink", classes: "bg-pink-50 text-pink-700 border-pink-200" },
];

function colorClasses(color: string): string {
  return COLOR_OPTIONS.find((c) => c.value === color)?.classes ?? COLOR_OPTIONS[0].classes;
}

export function CustomerTags({
  customerId,
  attachedTags,
  allTags,
}: {
  customerId: string;
  attachedTags: Tag[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const attachedIds = new Set(attachedTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !attachedIds.has(t.id));

  function handleAttach(tagId: string) {
    setError(null);
    startTransition(async () => {
      const result = await attachTagToCustomer({ customerId, tagId });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        setShowPicker(false);
      }
    });
  }

  function handleDetach(tagId: string) {
    setError(null);
    startTransition(async () => {
      const result = await detachTagFromCustomer({ customerId, tagId });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleCreate() {
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError("Tag name is required.");
      return;
    }
    startTransition(async () => {
      const result = await createTag({ name, color: newColor });
      if ("error" in result) {
        setError(result.error);
      } else {
        // Auto-attach the newly-created tag
        await attachTagToCustomer({ customerId, tagId: result.id });
        setNewName("");
        setNewColor("gray");
        setCreating(false);
        setShowPicker(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Attached tags row */}
      <div className="flex flex-wrap items-center gap-2">
        {attachedTags.length === 0 && !showPicker && (
          <div className="text-xs text-muted-foreground">No tags yet.</div>
        )}
        {attachedTags.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${colorClasses(tag.color)}`}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleDetach(tag.id)}
              disabled={isPending}
              className="hover:opacity-70 disabled:opacity-40"
              aria-label={`Remove tag ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {!showPicker && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-2 py-1"
          >
            + Add tag
          </button>
        )}
      </div>

      {/* Picker / Creator */}
      {showPicker && (
        <div className="border border-border rounded-md p-3 bg-muted/30 space-y-3">
          {!creating ? (
            <>
              {availableTags.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Existing tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAttach(tag.id)}
                        disabled={isPending}
                        className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium hover:opacity-80 disabled:opacity-40 ${colorClasses(tag.color)}`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreating(true)}
                  disabled={isPending}
                >
                  + Create new tag
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPicker(false)}
                  disabled={isPending}
                >
                  Done
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tag name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. VIP, corporate, weekly"
                  maxLength={40}
                  autoFocus
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Color
                </label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewColor(c.value)}
                      className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${c.classes} ${
                        newColor === c.value
                          ? "ring-2 ring-offset-1 ring-foreground"
                          : ""
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleCreate} disabled={isPending}>
                  {isPending ? "Creating…" : "Create + attach"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setNewColor("gray");
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}