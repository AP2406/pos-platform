import { useEffect, useRef } from "react";
import { View, LogBox, AppState } from "react-native";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { color } from "@surge/design-tokens";
import { SessionProvider, useSession } from "@/state/session";
import { NoticeHost } from "@/design";
import { SURFACE_ROUTE, AUX_ROUTES, type Surface } from "@/lib/access";
import { DEFAULT_LOCK_MIN, BACKGROUND_LOCK_MIN } from "@/lib/device-profile";

// v1 API failures are handled gracefully (they surface via the top NoticeHost
// banner and callers degrade), so suppress the redundant dev LogBox overlay that
// otherwise covers tappable UI. Dev-only; production never shows LogBox.
LogBox.ignoreLogs(["Network request failed"]);

const queryClient = new QueryClient();

// Route by session + ROLE ACCESS: sign-in until there's a full session, then land
// on the role/device home and keep the signed-in user out of disallowed surfaces.
// Navigation gating only — RLS remains the real data boundary.
function Gate() {
  const s = useSession();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!s.ready) return;
    const onSignIn = segments[0] === "sign-in";
    const authed = s.signedIn && !!s.businessId && !!s.staff;
    const home = SURFACE_ROUTE[s.access?.home ?? "floor"];
    const allowed = new Set<string>((s.access?.surfaces ?? ["floor", "register"]).map((x: Surface) => SURFACE_ROUTE[x]));
    // Staff tools ride alongside the Floor — allow them whenever the Floor is.
    if (allowed.has("/floor")) for (const r of AUX_ROUTES) allowed.add(r);
    const current = "/" + (segments[0] ?? "");

    if (!authed && !onSignIn) router.replace("/sign-in");
    else if (authed && onSignIn) router.replace(home);
    else if (authed && segments[0] && current !== "/" && !allowed.has(current)) router.replace(home);
  }, [s.ready, s.signedIn, s.businessId, s.staff, s.access, segments, router]);

  if (!s.ready) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return (
    <AutoLock>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
    </AutoLock>
  );
}

// Returns the iPad to the staff PIN pad after it sits idle (owner-configurable in
// Device settings) or comes back from the background after a couple of minutes —
// so a logged-in tablet left on the counter doesn't expose guests, discounts or
// settings to whoever picks it up. Kitchen-station iPads are shared screens and
// never lock. Touches are observed in the capture phase and never intercepted.
function AutoLock({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const lastTouch = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const lockAfterMin = s.deviceProfile.lockAfterMin ?? DEFAULT_LOCK_MIN;
  const armed = !!s.staff && lockAfterMin > 0 && s.deviceProfile.station !== "kitchen";
  const lock = s.clearStaff;

  useEffect(() => {
    if (!armed) return;
    lastTouch.current = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - lastTouch.current >= lockAfterMin * 60000) lock();
    }, 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        hiddenAt.current = hiddenAt.current ?? Date.now();
      } else if (state === "active") {
        const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        if (away >= BACKGROUND_LOCK_MIN * 60000) lock();
        else lastTouch.current = Date.now();
      }
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [armed, lockAfterMin, lock]);

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        lastTouch.current = Date.now();
        return false;
      }}
    >
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <SessionProvider>
          <Gate />
          <NoticeHost />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
