import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { resolveNativeAccess, type NativeRoleAccess, type NativeAccessConfig, type DeviceHome } from "@/lib/access";
import { loadDeviceProfile, saveDeviceProfile, DEFAULT_DEVICE_PROFILE, type DeviceProfile } from "@/lib/device-profile";
import { setDemoMode } from "@/lib/demo/state";
import { setActingStaffName, clockToggle } from "@/lib/api";

export type Staff = { id: string; name: string; role: string };
export type Biz = { id: string; name: string; role: string };

// The PIN is checked in exactly one place — the verify_staff_member_pin RPC —
// and the raw PostgREST/Postgres message is never shown for it. That message is
// rendered straight onto a pre-auth screen anyone at the counter can read, and
// it describes the shape of the verifier. Web already refuses to leak it
// (app/app/pos/staff-session.ts logs and returns a generic string); the iPad
// used to hand it over verbatim.
const PIN_CHECK_FAILED = "Couldn't check that PIN. Try again.";

const punchTime = () => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());

type SessionValue = {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  businesses: Biz[];
  businessId: string | null;
  businessName: string | null;
  staff: Staff | null;
  access: NativeRoleAccess | null; // allowed surfaces + home for the signed-in staff/device
  deviceHome: DeviceHome | null; // derived from the device profile's station (kds when Kitchen)
  setDeviceHome: (mode: DeviceHome | null) => void; // sign-in POS/KDS toggle (maps to station)
  deviceProfile: DeviceProfile; // this physical device's config (label/station/floor/printer)
  setDeviceProfile: (p: DeviceProfile) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  pickBusiness: (id: string) => Promise<void>;
  setStaffByPin: (pin: string) => Promise<{ error?: string }>;
  // Same PIN, different outcome: punch the clock WITHOUT signing this iPad in.
  punchByPin: (pin: string) => Promise<{ error?: string; message?: string }>;
  clearStaff: () => void;
};

const Ctx = createContext<SessionValue | null>(null);
const BIZ_KEY = "surge_active_business";
// The staff member this DEVICE is signed in as, kept across app restarts and dev
// reloads (like Square/Toast: the iPad stays on the last PIN'd person until
// "Switch staff" or Sign out). Keyed by business so switching locations re-asks.
const STAFF_KEY = "surge_device_staff";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [nativeConfig, setNativeConfig] = useState<NativeAccessConfig | null>(null);
  const [deviceProfile, setDeviceProfileState] = useState<DeviceProfile>(DEFAULT_DEVICE_PROFILE);
  // This device's KDS mode is derived from its assigned station.
  const deviceHome: DeviceHome | null = deviceProfile.station === "kitchen" ? "kds" : null;

  const loadBusinesses = useCallback(async (userId: string) => {
    const { data: members } = await supabase.from("business_members").select("business_id, role").eq("user_id", userId);
    const ids = (members ?? []).map((m) => m.business_id as string);
    const roleById: Record<string, string> = {};
    for (const m of members ?? []) roleById[m.business_id as string] = (m.role as string) || "staff";
    let list: Biz[] = [];
    if (ids.length > 0) {
      const { data: bizRows } = await supabase.from("businesses").select("id, name").in("id", ids);
      list = (bizRows ?? []).map((b) => ({ id: b.id as string, name: (b.name as string) || "Business", role: roleById[b.id as string] || "staff" }));
    }
    setBusinesses(list);
    const saved = await AsyncStorage.getItem(BIZ_KEY);
    const pick = list.find((b) => b.id === saved) ?? list[0] ?? null;
    setBusinessId(pick?.id ?? null);
    // Restore the device's signed-in staff member for that business.
    try {
      const raw = await AsyncStorage.getItem(STAFF_KEY);
      const stored = raw ? (JSON.parse(raw) as { businessId?: string; staff?: Staff }) : null;
      if (stored?.staff?.id && stored.businessId && stored.businessId === pick?.id) setStaff(stored.staff);
    } catch {
      /* ignore a bad cache */
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!active) return;
      setUserEmail(user?.email ?? null);
      if (user) await loadBusinesses(user.id);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user ?? null;
      setUserEmail(user?.email ?? null);
      if (user) loadBusinesses(user.id);
      else {
        setBusinesses([]);
        setBusinessId(null);
        setStaff(null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadBusinesses]);

  // This device's profile (persisted locally; migrates the legacy pos/kds flag).
  useEffect(() => {
    loadDeviceProfile().then(setDeviceProfileState);
  }, []);

  // Demo restaurant mode follows the device profile (dev builds only — see lib/demo).
  useEffect(() => {
    setDemoMode(deviceProfile.demoMode === true);
  }, [deviceProfile.demoMode]);

  // The demo API shims attribute fires/clock-ins to the signed-in staff member.
  useEffect(() => {
    setActingStaffName(staff?.name ?? null);
  }, [staff]);

  const setDeviceProfile = useCallback((p: DeviceProfile) => {
    setDeviceProfileState(p);
    saveDeviceProfile(p);
  }, []);

  // Sign-in POS/KDS toggle → the Kitchen station (leaves richer stations intact).
  const setDeviceHome = useCallback((mode: DeviceHome | null) => {
    setDeviceProfileState((prev) => {
      const station = mode === "kds" ? "kitchen" : prev.station === "kitchen" ? null : prev.station;
      const next = { ...prev, station } as DeviceProfile;
      saveDeviceProfile(next);
      return next;
    });
  }, []);

  // Owner's role->surface overrides (settings.native_access) for the active business.
  useEffect(() => {
    if (!businessId) {
      setNativeConfig(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("businesses").select("settings").eq("id", businessId).maybeSingle();
      const na = ((data?.settings ?? {}) as { native_access?: NativeAccessConfig }).native_access ?? null;
      setNativeConfig(na);
    })();
  }, [businessId]);

  const station = deviceProfile.station;
  const access = useMemo<NativeRoleAccess | null>(
    () => (staff ? resolveNativeAccess(staff.role, nativeConfig, deviceHome, station) : station ? resolveNativeAccess("", nativeConfig, deviceHome, station) : null),
    [staff, nativeConfig, deviceHome, station]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(STAFF_KEY);
    setStaff(null);
    await supabase.auth.signOut();
  }, []);

  const pickBusiness = useCallback(async (id: string) => {
    setBusinessId(id);
    setStaff(null);
    await AsyncStorage.removeItem(STAFF_KEY);
    await AsyncStorage.setItem(BIZ_KEY, id);
  }, []);

  const setStaffByPin = useCallback(
    async (pin: string) => {
      if (!businessId) return { error: "Pick a business first." };
      if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4–6 digit PIN." };
      const { data, error } = await supabase.rpc("verify_staff_member_pin", { p_business_id: businessId, p_pin: pin });
      if (error) return { error: PIN_CHECK_FAILED };
      const row = (Array.isArray(data) ? data[0] : data) as { id?: string; name?: string; role?: string } | null;
      if (!row?.id) return { error: "PIN not recognized." };
      const next: Staff = { id: row.id, name: row.name ?? "Staff", role: row.role ?? "staff" };
      setStaff(next);
      AsyncStorage.setItem(STAFF_KEY, JSON.stringify({ businessId, staff: next })).catch(() => {});
      return {};
    },
    [businessId]
  );

  // The PIN pad's SECOND submit. TouchBistro puts a full-width "Clock In/Out"
  // bar directly under its keypad: the same digits you would sign in with, spent
  // on a punch instead. We verified that on a real terminal — it punches and
  // stays on the PIN screen.
  //
  // Three things this deliberately does NOT do:
  //  1. It does not setStaff or write STAFF_KEY. A punch is not a session. A
  //     cook clocking on must not take the till away from whoever is ringing,
  //     and "the device is now signed in as the last person who clocked out"
  //     would be an attribution bug, not a convenience.
  //  2. It does not verify the PIN any differently. Same RPC, same sole
  //     verifier, same 4–6 bound — the identity it returns is simply spent on
  //     /api/v1/clock instead of on the local session.
  //  3. It does not keep the PIN anywhere. `pin` is an argument and dies here.
  //
  // The bearer token and business are already established by this point (PIN is
  // step 3 of 3), so resolveApiContext has everything it needs; the staff id
  // from the RPC is what fills X-Surge-Staff.
  const punchByPin = useCallback(
    async (pin: string): Promise<{ error?: string; message?: string }> => {
      if (!businessId) return { error: "Pick a business first." };
      if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4–6 digit PIN." };
      const { data, error } = await supabase.rpc("verify_staff_member_pin", { p_business_id: businessId, p_pin: pin });
      if (error) return { error: PIN_CHECK_FAILED };
      const row = (Array.isArray(data) ? data[0] : data) as { id?: string; name?: string } | null;
      if (!row?.id) return { error: "PIN not recognized." };
      try {
        const res = await clockToggle(businessId, row.id, "toggle");
        const verb =
          res.action === "in" ? "Clocked in" : res.action === "out" ? "Clocked out" : res.action === "break_start" ? "Break started" : "Break ended";
        return { message: `${verb} · ${res.name || row.name || "Staff"} · ${punchTime()}` };
      } catch (e) {
        // api.send() has already raised the top banner for network/HTTP
        // failures; this is the inline copy, which is the surface the person
        // standing at the pad is actually looking at.
        return { error: e instanceof Error ? e.message : "Couldn't reach the time clock." };
      }
    },
    [businessId]
  );

  // "Switch staff": back to the PIN pad without signing the device out of Surge.
  const clearStaff = useCallback(() => {
    setStaff(null);
    AsyncStorage.removeItem(STAFF_KEY).catch(() => {});
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      signedIn: !!userEmail,
      userEmail,
      businesses,
      businessId,
      businessName: businesses.find((b) => b.id === businessId)?.name ?? null,
      staff,
      access,
      deviceHome,
      setDeviceHome,
      deviceProfile,
      setDeviceProfile,
      signIn,
      signOut,
      pickBusiness,
      setStaffByPin,
      punchByPin,
      clearStaff,
    }),
    [ready, userEmail, businesses, businessId, staff, access, deviceHome, setDeviceHome, deviceProfile, setDeviceProfile, signIn, signOut, pickBusiness, setStaffByPin, punchByPin, clearStaff]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within SessionProvider");
  return v;
}
