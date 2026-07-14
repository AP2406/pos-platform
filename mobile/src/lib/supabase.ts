import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Same Supabase project as the web app. Used for auth + direct reads (menu, floor,
// tickets, KDS) — RLS enforces tenancy. Money WRITES go through the v1 HTTP API.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// A uniquely-named realtime channel per subscription. supabase.channel(name) caches
// by name and returns the SAME (possibly already-SUBSCRIBED) channel; calling .on()
// on that throws "cannot add ... callbacks after subscribe()" when a screen
// re-mounts before the old channel is torn down. A fresh name per mount avoids it;
// the effect cleanup still removeChannel()s it.
let channelSeq = 0;
export function realtimeChannel(base: string) {
  channelSeq += 1;
  return supabase.channel(`${base}-${channelSeq}`);
}
