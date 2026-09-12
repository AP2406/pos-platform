"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { pingFinix } from "./finix-actions";

type PingResult = Awaited<ReturnType<typeof pingFinix>>;

export function FinixPingButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PingResult | null>(null);

  function handlePing() {
    setResult(null);
    startTransition(async () => {
      const r = await pingFinix();
      setResult(r);
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={handlePing} disabled={isPending}>
        {isPending ? "Pinging…" : "Ping Finix"}
      </Button>

      {result && "ok" in result && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2">
          <div className="text-sm font-medium text-green-900">✓ Success</div>
          <div className="text-xs text-green-800">{result.summary}</div>
          <pre className="text-[11px] bg-white border border-green-200 rounded p-2 overflow-x-auto text-gray-700 mt-2">
            {JSON.stringify(result.sample, null, 2)}
          </pre>
        </div>
      )}

      {result && "error" in result && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-2">
          <div className="text-sm font-medium text-red-900">✗ Failed</div>
          <div className="text-xs text-red-800">{result.error}</div>
          {result.details ? (
            <pre className="text-[11px] bg-white border border-red-200 rounded p-2 overflow-x-auto text-gray-700 mt-2">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}