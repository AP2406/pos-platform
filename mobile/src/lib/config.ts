import Constants from "expo-constants";
import { Platform } from "react-native";

// Runtime config from app.json `extra` (override per-build via EAS env / app.config).
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";
// The web app hosts the shared v1 API (Route Handlers). Resolution order:
// EAS build-profile env (EXPO_PUBLIC_API_BASE_URL, set per profile in eas.json) →
// app.json extra (the dev default) → hard fallback. This lets a production/pilot
// build target a stable host without editing app.json.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? "https://app.surgetechpos.com";

// Shown quietly on the sign-in screen. Pure support value: the first question
// asked about a misbehaving terminal is "what is it running", and the person
// standing in front of it should not have to open Settings to answer.
// `version` is app.json's; `buildNumber` distinguishes two builds of the same
// version, which is exactly the case a support call runs into.
const iosBuild = (Constants.expoConfig?.ios?.buildNumber ?? "").trim();
export const APP_VERSION = (Constants.expoConfig?.version ?? "0.0.0") + (iosBuild ? ` (${iosBuild})` : "");

// Hardware class for the same support line. Derived from RN's own Platform
// rather than a new dependency (expo-device is not installed, and one string on
// one screen does not justify adding it).
export const DEVICE_KIND = Platform.OS === "ios" ? (Platform.isPad ? "iPad" : "iPhone") : Platform.OS === "android" ? "Android" : "Device";
