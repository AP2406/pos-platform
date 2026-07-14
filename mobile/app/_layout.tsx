import { useEffect } from "react";
import { View } from "react-native";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { color } from "@surge/design-tokens";
import { SessionProvider, useSession } from "@/state/session";
import { SURFACE_ROUTE, AUX_ROUTES, type Surface } from "@/lib/access";

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
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />;
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
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
