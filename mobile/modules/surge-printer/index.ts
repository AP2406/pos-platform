import { requireOptionalNativeModule } from "expo";

// JS bridge to the SurgePrinter native module. Present once the app is built with
// this local module (prebuild + pod install); null in Expo Go or if unlinked, in
// which case callers fall back to the no-op. The native side currently returns a
// no-op success — see modules/surge-printer/ios/SurgePrinterModule.swift.

export type NativePrinterTarget = {
  id: string;
  brand: string; // "star" | "epson" | "none"
  connection: string; // "lan" | "bluetooth" | "usb"
  address?: string | null;
  widthMm: number; // 58 | 80
};

type SurgePrinterNativeModule = {
  printJob(target: NativePrinterTarget, payload: string): Promise<{ printed: boolean }>;
  discover(): Promise<NativePrinterTarget[]>;
};

const native = requireOptionalNativeModule<SurgePrinterNativeModule>("SurgePrinter");

export function isNativePrinterAvailable(): boolean {
  return native != null;
}

export async function printJob(target: NativePrinterTarget, payload: string): Promise<{ printed: boolean }> {
  if (!native) return { printed: false };
  return native.printJob(target, payload);
}

export async function discover(): Promise<NativePrinterTarget[]> {
  if (!native) return [];
  return native.discover();
}
