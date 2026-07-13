import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
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
        <Text style={[text.display, { marginBottom: space.xs }]}>Surge POS</Text>

        {step === "auth" && (
          <View style={styles.card}>
            <Text style={text.bodyDim}>Sign in</Text>
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={color.textFaint} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={color.textFaint} secureTextEntry value={password} onChangeText={setPassword} />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button title="Sign in" onPress={doSignIn} loading={busy} />
          </View>
        )}

        {step === "business" && (
          <View style={styles.card}>
            <Text style={text.bodyDim}>Choose a location</Text>
            {s.businesses.length === 0 && <Text style={styles.err}>No businesses on this account.</Text>}
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
            <Text style={text.bodyDim}>{s.businessName} — enter your PIN</Text>
            <Text style={styles.pinDots}>{"•".repeat(pin.length).padEnd(4, "·")}</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <NumPad onKey={onPinKey} decimal={false} />
            <Button title="Continue" onPress={submitPin} loading={busy} disabled={pin.length < 4} />
            <Button title="Switch location" variant="ghost" onPress={() => s.pickBusiness("")} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  card: { width: 340, maxWidth: "100%", backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, padding: space.xl, gap: space.md },
  input: { minHeight: touch.min, backgroundColor: color.card2, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, color: color.text },
  bizRow: { minHeight: touch.min, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  err: { color: color.late, fontSize: 13 },
  pinDots: { color: color.text, fontSize: 28, letterSpacing: 8, textAlign: "center", paddingVertical: space.sm },
});
