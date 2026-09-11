import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, NumPad, color, space, radius, text, touch } from "@/design";
import { useSession } from "@/state/session";

// Minimal session bootstrap: email+password (closed registration, same as web) →
// pick a business → staff PIN. Pure auth/reads; no money path.
export default function SignIn() {
  const s = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const step: "auth" | "business" | "pin" = !s.signedIn ? "auth" : !s.businessId ? "business" : "pin";

  async function doSignIn() {
    setErr(null);
    setBusy(true);
    const res = await s.signIn(email, password);
    setBusy(false);
    if (res.error) setErr(res.error);
  }
  async function submitPin() {
    setErr(null);
    setBusy(true);
    const res = await s.setStaffByPin(pin);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      setPin("");
    }
  }
  function onPinKey(k: string) {
    setErr(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (/[0-9]/.test(k)) setPin((p) => (p.length >= 6 ? p : p + k));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {/* THE REAL LOCKUP REPLACES THE TYPESET PILL. This screen is the one
            unambiguous brand moment the native app has — a centred, otherwise
            empty sign-in — so it gets the horizontal lockup at the kit's 220pt
            floor, not "SURGE" letterspaced inside a blue chip. That chip was
            also the worst white-on-blue case on the surface: at 14pt it needed
            4.5:1 and the kit blue gives 3.39:1, so replacing it removes the
            contrast problem rather than working around it.
            A PNG and not vector: the lockup's wordmark is five long outline
            paths under a compound scale/flip transform, and a raster at 3x
            (660px for a 220pt box) is both smaller and certain to be correct.
            The optical ICON is the opposite call — see SurgeIcon.tsx. */}
        <View style={styles.brand}>
          <Image
            source={require("../assets/surge-lockup.png")}
            style={styles.lockup}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Surge"
          />
          <Text style={text.title}>Point of Sale</Text>
        </View>

        {step === "auth" && (
          <View style={styles.card}>
            <Text style={text.heading}>Sign in</Text>
            <Text style={text.bodyDim}>Use your Surge account, then each team member enters their PIN.</Text>
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={color.textFaint} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={color.textFaint} secureTextEntry value={password} onChangeText={setPassword} />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button title="Sign in" size="lg" onPress={doSignIn} loading={busy} />
          </View>
        )}

        {step === "business" && (
          <View style={styles.card}>
            <Text style={text.heading}>Choose a location</Text>
            {s.businesses.length === 0 && <Text style={styles.err}>This account isn't a member of any business yet. Ask the owner to invite you from the Surge web dashboard.</Text>}
            {s.businesses.map((b) => (
              <Pressable key={b.id} style={styles.bizRow} onPress={() => s.pickBusiness(b.id)}>
                <Text style={text.body}>{b.name}</Text>
                <Text style={text.caption}>{b.role}</Text>
              </Pressable>
            ))}
            <Button title="Sign out" variant="ghost" onPress={s.signOut} />
          </View>
        )}

        {step === "pin" && (
          <View style={styles.card}>
            <Text style={text.heading}>{s.businessName}</Text>
            <Text style={text.bodyDim}>Enter your staff PIN</Text>
            <Text style={styles.pinDots}>{"•".repeat(pin.length).padEnd(4, "·")}</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <NumPad onKey={onPinKey} decimal={false} />
            <Button title="Continue" size="lg" onPress={submitPin} loading={busy} disabled={pin.length < 4} />
            <Button title="Switch location" variant="ghost" onPress={() => s.pickBusiness("")} />
          </View>
        )}

        {s.signedIn && (
          <View style={styles.deviceRow}>
            <Text style={text.caption}>This iPad is a</Text>
            <Pressable onPress={() => s.setDeviceHome(null)} style={[styles.deviceBtn, s.deviceHome !== "kds" && styles.deviceOn]} accessibilityRole="radio" accessibilityState={{ checked: s.deviceHome !== "kds" }}>
              <Text style={[text.caption, s.deviceHome !== "kds" && styles.deviceOnTxt]}>Register</Text>
            </Pressable>
            <Pressable onPress={() => s.setDeviceHome("kds")} style={[styles.deviceBtn, s.deviceHome === "kds" && styles.deviceOn]} accessibilityRole="radio" accessibilityState={{ checked: s.deviceHome === "kds" }}>
              <Text style={[text.caption, s.deviceHome === "kds" && styles.deviceOnTxt]}>Kitchen screen</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  brand: { alignItems: "center", gap: space.sm, marginBottom: space.lg },
  // 220 x 65 is the kit's stated starting size for the horizontal lockup, at
  // its native 980:290 ratio — no stretching.
  lockup: { width: 220, height: 65 },
  card: { width: 380, maxWidth: "100%", backgroundColor: color.card, borderRadius: radius.tile, borderWidth: 1, borderColor: color.border, padding: space.xl, gap: space.md },
  input: { minHeight: touch.min, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 16 },
  bizRow: { minHeight: touch.min + 4, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  err: { color: color.late, fontSize: 14, fontFamily: "Poppins_500Medium" },
  pinDots: { color: color.text, fontSize: 32, letterSpacing: 10, textAlign: "center", paddingVertical: space.sm },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  deviceBtn: { minHeight: 40, justifyContent: "center", paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: 999, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  deviceOn: { borderColor: color.blue, backgroundColor: color.blue },
  deviceOnTxt: { color: color.onPrimary, fontFamily: "Poppins_600SemiBold" },
});
