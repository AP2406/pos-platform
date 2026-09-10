import Constants from "expo-constants";

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
