import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type Staff = { id: string; name: string; role: string };
export type Biz = { id: string; name: string; role: string };

type SessionValue = {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  businesses: Biz[];
  businessId: string | null;
  businessName: string | null;
  staff: Staff | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  pickBusiness: (id: string) => Promise<void>;
  setStaffByPin: (pin: string) => Promise<{ error?: string }>;
  clearStaff: () => void;
};

const Ctx = createContext<SessionValue | null>(null);
const BIZ_KEY = "surge_active_business";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const pickBusiness = useCallback(async (id: string) => {
    setBusinessId(id);
    setStaff(null);
    await AsyncStorage.setItem(BIZ_KEY, id);
  }, []);

  const setStaffByPin = useCallback(
    async (pin: string) => {
      if (!businessId) return { error: "Pick a business first." };
      if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4–6 digit PIN." };
      const { data, error } = await supabase.rpc("verify_staff_member_pin", { p_business_id: businessId, p_pin: pin });
      if (error) return { error: error.message };
      const row = (Array.isArray(data) ? data[0] : data) as { id?: string; name?: string; role?: string } | null;
      if (!row?.id) return { error: "PIN not recognized." };
      setStaff({ id: row.id, name: row.name ?? "Staff", role: row.role ?? "staff" });
      return {};
    },
    [businessId]
  );

  const clearStaff = useCallback(() => setStaff(null), []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      signedIn: !!userEmail,
      userEmail,
      businesses,
      businessId,
      businessName: businesses.find((b) => b.id === businessId)?.name ?? null,
      staff,
      signIn,
      signOut,
      pickBusiness,
      setStaffByPin,
      clearStaff,
    }),
    [ready, userEmail, businesses, businessId, staff, signIn, signOut, pickBusiness, setStaffByPin, clearStaff]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within SessionProvider");
  return v;
}
