"use client";

import { useEffect, useRef, useState } from "react";

// Reusable Finix.js hosted-card tokenization: loads the SDK, wires the fraud Auth
// session, mounts the PaymentForm into `containerId`, and hands back a `tokenize()`
// that returns a one-time card token (+ fraud session) — no PAN ever touches Surge.
// The bar-tab card-hold modal uses this. The card-SALE modal (card-payment-modal.tsx)
// predates the hook and keeps its own inline copy on purpose: it's the primary money
// path and is left frozen rather than refactored for a tab feature. New card surfaces
// should use this hook.
export type FinixConfig = { applicationId: string; environment: string; merchantId: string };

export type TokenizeResult = { token: string; fraudSessionId?: string } | { error: string };

export function useFinixCardForm(config: FinixConfig, containerId: string, enabled: boolean = true) {
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const formRef = useRef<any>(null);
  const fraudRef = useRef<any>(null);

  // Load the Finix.js script once (shared #finix-sdk tag across the app).
  useEffect(
    function () {
      if (!enabled) return;
      const w = window as any;
      if (w.Finix) {
        setSdkReady(true);
        return;
      }
      const existing = document.getElementById("finix-sdk");
      if (existing) {
        existing.addEventListener("load", function () {
          setSdkReady(true);
        });
        return;
      }
      const script = document.createElement("script");
      script.id = "finix-sdk";
      script.src = "https://js.finix.com/v/2/finix.js";
      script.async = true;
      script.onload = function () {
        setSdkReady(true);
      };
      script.onerror = function () {
        setInitError("Could not load the secure card library. A VPN, ad blocker, or browser shield may be blocking js.finix.com. Disable it for this site and reopen.");
      };
      document.body.appendChild(script);
    },
    [enabled]
  );

  // Once the SDK is ready, initialize the fraud Auth (must come before the form so it
  // can instrument the page) and mount the hosted payment fields.
  useEffect(
    function () {
      if (!enabled) return;
      const w = window as any;
      if (!sdkReady || !w.Finix) return;
      if (formRef.current) return;
      try {
        try {
          if (typeof w.Finix.Auth === "function") {
            fraudRef.current = w.Finix.Auth(config.environment, config.merchantId);
          }
        } catch (e2) {
          fraudRef.current = null;
        }
        if (typeof w.Finix.PaymentForm !== "function") {
          setInitError("The card library loaded but is missing the payment form.");
          return;
        }
        formRef.current = w.Finix.PaymentForm(containerId, config.environment, config.applicationId, { onUpdate: function () {} });
      } catch (e) {
        setInitError("Could not set up the card fields: " + String(e));
      }
    },
    [sdkReady, config.environment, config.applicationId, config.merchantId, containerId, enabled]
  );

  function readFraudSession(): string | undefined {
    try {
      const a = fraudRef.current;
      if (a && typeof a.getSessionKey === "function") return a.getSessionKey();
      if (a && typeof a.getSession === "function") return a.getSession();
    } catch (e) {}
    return undefined;
  }

  // Submit the hosted fields and resolve to a one-time token. Never rejects.
  function tokenize(): Promise<TokenizeResult> {
    return new Promise(function (resolve) {
      if (!formRef.current) {
        resolve({ error: "The card fields aren't ready yet." });
        return;
      }
      try {
        formRef.current.submit(function (error: any, response: any) {
          if (error) {
            resolve({ error: "The card details couldn't be read. Check them and try again." });
            return;
          }
          const token = ((response && response.data) || {}).id;
          if (!token) {
            resolve({ error: "The card couldn't be processed. Please try again." });
            return;
          }
          resolve({ token: token, fraudSessionId: readFraudSession() });
        });
      } catch (e) {
        resolve({ error: "Could not submit the card: " + String(e) });
      }
    });
  }

  return { sdkReady, initError, tokenize };
}
