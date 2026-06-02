"use client";

import { useEffect, useRef, useState } from "react";

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    let done = false;

    async function start() {
      try {
        const mod = await import("@zxing/browser");
        const reader = new mod.BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;

        const result = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (res) => {
            if (res && !cancelled && !done) {
              done = true;
              onDetected(res.getText());
            }
          }
        );
        controls = result as { stop: () => void };
        if (cancelled && controls) controls.stop();
      } catch (e) {
        console.error("BarcodeScanner:", e);
        if (!cancelled) {
          setError(
            "Could not start the camera. Allow camera access and make sure you are on https."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (controls) controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg p-4 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-sm">Scan a barcode</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Close
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-md bg-black"
              muted
              playsInline
            />
            <div className="absolute inset-0 border-2 border-white/60 rounded-md pointer-events-none" />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Point the camera at a barcode. The item is added automatically.
        </p>
      </div>
    </div>
  );
}