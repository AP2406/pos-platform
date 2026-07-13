import Constants from "expo-constants";

// Runtime config from app.json `extra` (override per-build via EAS env / app.config).
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
};

export const SUPABASE_URL = extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? "";
// The web app hosts the shared v1 API (Route Handlers). Points at app. in prod.
export const API_BASE_URL = extra.apiBaseUrl ?? "https://app.surgetechpos.com";
