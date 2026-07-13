import { useEffect } from "react";
import { View } from "react-native";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { color } from "@surge/design-tokens";
import { SessionProvider, useSession } from "@/state/session";

const queryClient = new QueryClient();

// Redirect to sign-in until there's a Supabase session + an active business + a
// staff PIN. Everything past the gate can assume a full session.
function Gate() {
  const s = useSession();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!s.ready) return;
    const onSignIn = segments[0] === "sign-in";
    const authed = s.signedIn && !!s.businessId && !!s.staff;
    if (!authed && !onSignIn) router.replace("/sign-in");
    else if (authed && onSignIn) router.replace("/floor");
  }, [s.ready, s.signedIn, s.businessId, s.staff, segments, router]);

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
