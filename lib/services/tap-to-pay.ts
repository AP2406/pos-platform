// GAP-1 (5/5): Tap to Pay / SoftPOS. The actual contactless read happens in the
// native iOS wrapper via Finix's Tap to Pay on iPhone SDK, exposed to the web layer
// as a Capacitor bridge on `window.SurgeTapToPay`. This module is the thin web-side
// contract: detect the bridge and ask it to collect a tokenized card. On the web
// (no bridge) it's simply unavailable, so the register falls back to a reader/manual
// entry exactly as today. The returned token feeds the same createCardOrder charge
// path as a manually-keyed card — no separate money path.

export type TapToPayParams = {
  amountCents: number;
  currency: string;
  merchantId: string;
  applicationId: string;
  environment: string; // "sandbox" | "prod"
};

type TapToPayBridge = {
  collect: (p: TapToPayParams) => Promise<{ token?: string; error?: string }>;
  isSupported?: () => boolean | Promise<boolean>;
};

declare global {
  interface Window {
    SurgeTapToPay?: TapToPayBridge;
  }
}

// True only inside the native app where the Tap to Pay bridge is injected.
export function tapToPayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.SurgeTapToPay && typeof window.SurgeTapToPay.collect === "function";
}

// Ask the native SDK to read a contactless card and return a Finix token.
export async function collectTapToPay(p: TapToPayParams): Promise<{ token: string } | { error: string }> {
  if (!tapToPayAvailable()) return { error: "Tap to Pay isn't available on this device." };
  try {
    const res = await window.SurgeTapToPay!.collect(p);
    if (res && res.token) return { token: res.token };
    return { error: res?.error || "The tap was cancelled." };
  } catch (e) {
    return { error: "Tap to Pay failed: " + String(e) };
  }
}
