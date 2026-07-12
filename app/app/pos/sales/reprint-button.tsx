"use client";

import { useState, useTransition } from "react";
import { getReceiptHtml } from "./receipt-actions";

// Reprint a past sale's original receipt from its stored snapshot — opens the rendered
// receipt in a print window (same browser-print path the refund receipt uses). No new
// data model; the server re-renders the exact receipt the sale produced.
export function ReprintButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reprint() {
    setError(null);
    startTransition(async () => {
      const res = await getReceiptHtml(orderId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const win = window.open("", "_blank", "width=340,height=640");
      if (!win) {
        setError("Allow pop-ups to print the receipt.");
        return;
      }
      win.document.write(res.html);
      win.document.close();
      win.focus();
      win.print();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={reprint}
        disabled={pending}
        className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Printing…" : "Print"}
      </button>
      {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
    </>
  );
}
