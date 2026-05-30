"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateTripFromConversation } from "../lead-from-email-actions";

export function UpdateFromConversation({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleUpdate() {
    if (!text.trim()) {
      setError("Paste the conversation first.");
      return;
    }
    setLoading(true);
    setError(null);
    setDone(null);
    const result = await updateTripFromConversation(tripId, text);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setDone("Updated " + result.updated.join(", ") + ".");
      setText("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Paste the full email thread with the client. The AI will pull the final price, pickup/dropoff, time, flight, and details, and update this trip."
        className="w-full rounded-md border border-border bg-background p-3 text-sm resize-y"
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleUpdate} disabled={loading} size="sm">
          {loading ? "Reading conversation..." : "Update trip with AI"}
        </Button>
        {done ? <span className="text-sm text-green-600">{done}</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}