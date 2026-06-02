"use client";

import { useState, useTransition } from "react";
import { emailReceipt } from "./receipt-actions";

export function EmailReceiptButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setEmail("");
    setError(null);
    setDone(false);
  }

  function send() {
    setError(null);
    const to = email.trim();
    if (!to) {
      setError("Enter an email address.");
      return;
    }
    startTransition(async () => {
      const res = await emailReceipt(orderId, to);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline hover:text-foreground"
      >
        Email
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Email receipt</h3>
              <button
                type="button"
                onClick={close}
                className="text-xs text-muted-foreground underline"
              >
                Close
              </button>
            </div>
            {done ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-500">Receipt sent.</p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border hover:bg-accent"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full h-9 rounded-md border border-border bg-transparent text-foreground px-3 text-sm"
                />
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={send}
                    disabled={pending}
                    className="flex-1 px-3 py-2 text-sm rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Sending..." : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-border hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}