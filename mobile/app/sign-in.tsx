import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, NumPad, color, space, radius, text, touch, fontFamily, fontSize } from "@/design";
import { useSession } from "@/state/session";
import { useApiReachable } from "@/lib/use-online";
import { APP_VERSION, DEVICE_KIND } from "@/lib/config";

// Minimal session bootstrap: email+password (closed registration, same as web) →
// pick a business → staff PIN. Pure auth/reads; no money path.
//
// The PIN step is the screen this terminal sits on all day. Three things about
// its shape are drawn from terminals we measured rather than from taste:
//
//  - The card stays narrow and centred (~380pt). TouchBistro is 302, Square 320,
//    we are the widest of the three already. Width was never the gap.
//  - Submit lives ON the pad (⌫ 0 ✓, TouchBistro) and "Clock In/Out" sits
//    directly under it as a SECOND submit for the same digits. That is the one
//    convention all three terminals keep and we did not.
//  - The device's ROLE is the headline. It used to be a 40pt toggle pinned to
//    the bottom edge; it is the most consequential fact about a till, and the
//    person setting one up should not have to hunt for it.
//
// What fills the rest of a 1080×810 landscape iPad is a single state line, not a
// bigger keypad.
export default function SignIn() {
  const s = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState<null | "signIn" | "punch">(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const reachable = useApiReachable();

  const step: "auth" | "business" | "pin" = !s.signedIn ? "auth" : !s.businessId ? "business" : "pin";
  const isKds = s.deviceHome === "kds";

  async function doSignIn() {
    setErr(null);
    setBusy("signIn");
    const res = await s.signIn(email, password);
    setBusy(null);
    if (res.error) setErr(res.error);
  }

  // ✓ on the pad: the PIN signs this iPad in, as it always did.
  async function submitPin() {
    if (busy) return;
    setErr(null);
    setOk(null);
    setBusy("signIn");
    const res = await s.setStaffByPin(pin);
    setBusy(null);
    if (res.error) {
      setErr(res.error);
      setPin("");
    }
    // On success the router gate swaps this screen out; nothing to clear.
  }

  // "Clock In/Out": the SAME digits, spent on a punch instead of a session.
  // Stays on this screen either way — TouchBistro does not navigate, and a punch
  // is not a reason to hand the terminal to whoever just walked past it.
  async function punch() {
    if (busy) return;
    setErr(null);
    setOk(null);
    setBusy("punch");
    const res = await s.punchByPin(pin);
    setBusy(null);
    setPin("");
    if (res.error) setErr(res.error);
    else if (res.message) setOk(res.message);
  }

  function onPinKey(k: string) {
    if (k === "confirm") return void submitPin();
    setErr(null);
    setOk(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    // 6 is the ceiling verify_staff_member_pin accepts; the 4-digit floor is
    // enforced by setStaffByPin, not here, so there is only ever one length rule.
    else if (/[0-9]/.test(k)) setPin((p) => (p.length >= 6 ? p : p + k));
  }

  const reachLabel = reachable === "online" ? "Online" : reachable === "offline" ? "Offline" : "Checking…";
  const reachTint = reachable === "online" ? color.success : reachable === "offline" ? color.late : color.textFaint;
  const role = isKds ? "Kitchen screen" : "Register";

  // TouchBistro swaps "Enter passcode" for a red "Invalid Passcode" in the same
  // header slot rather than adding a line. Matching that keeps the card height
  // fixed, which is what lets the whole thing fit 810pt without scrolling.
  const headline = err ?? ok ?? "Enter your staff PIN";
  const headlineStyle = err ? styles.headErr : ok ? styles.headOk : styles.head;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markTxt}>SURGE</Text>
          </View>
          <Text style={text.captionStrong}>Point of Sale</Text>
        </View>

        {/* Device role stays changeable before anyone authenticates — setting up
            a new terminal happens before there is a PIN to type. */}
        {s.signedIn && (
          <View style={styles.rolePicker} accessibilityRole="radiogroup" accessibilityLabel="This iPad is a">
            <Text style={text.eyebrow}>This iPad is a</Text>
            <Pressable
              onPress={() => s.setDeviceHome(null)}
              style={[styles.rolePill, !isKds && styles.rolePillOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: !isKds }}
            >
              <Text style={[styles.rolePillTxt, !isKds && styles.rolePillTxtOn]}>Register</Text>
            </Pressable>
            <Pressable
              onPress={() => s.setDeviceHome("kds")}
              style={[styles.rolePill, isKds && styles.rolePillOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isKds }}
            >
              <Text style={[styles.rolePillTxt, isKds && styles.rolePillTxtOn]}>Kitchen screen</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {step === "auth" && (
          <View style={styles.card}>
            <Text style={text.heading}>Sign in</Text>
            <Text style={text.bodyDim}>Use your Surge account, then each team member enters their PIN.</Text>
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={color.textFaint} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={color.textFaint} secureTextEntry value={password} onChangeText={setPassword} />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Button title="Sign in" size="lg" onPress={doSignIn} loading={busy === "signIn"} />
          </View>
        )}

        {step === "business" && (
          <View style={styles.card}>
            <Text style={text.heading}>Choose a location</Text>
            {s.businesses.length === 0 && <Text style={styles.err}>This account isn&apos;t a member of any business yet. Ask the owner to invite you from the Surge web dashboard.</Text>}
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
          <>
            <Text style={styles.role}>{role}</Text>

            <View style={styles.card}>
              <Text style={headlineStyle} accessibilityLiveRegion="polite" accessibilityRole="header">
                {headline}
              </Text>
              <Text style={styles.pinDots} accessibilityLabel={pin.length === 0 ? "No digits entered" : `${pin.length} digits entered`}>
                {"•".repeat(pin.length).padEnd(4, "·")}
              </Text>

              {/* ⌫ 0 ✓ — no empty cell, and no separate Continue below. See the
                  NumPad comment for why the hole had to go. */}
              <NumPad onKey={onPinKey} decimal={false} size="lg" confirm={{ label: "Sign in", busy: busy === "signIn" }} />

              {/* Second submit, full card width, directly under the pad — the
                  TouchBistro placement. Never disabled: an empty field is
                  answered inline ("Enter your 4–6 digit PIN.") rather than by a
                  control that silently refuses to respond. */}
              <Button title="Clock In/Out" variant="secondary" size="lg" onPress={punch} loading={busy === "punch"} accessibilityLabel="Clock in or out with this PIN" />
            </View>

            <Button title="Switch location" variant="ghost" onPress={() => s.pickBusiness("")} />
          </>
        )}
      </ScrollView>

      {/* One centred state line, TouchBistro's idea, minus its worst habit:
          TouchBistro prints "BELL303, 192.168.2.182" here. That is the venue's
          internal network topology on a pre-auth screen anyone at the counter
          can read. Role, hardware, which venue this terminal is pointed at,
          whether it can reach us, and what it is running — no host, no LAN
          address, no port. */}
      <Text style={styles.stateLine} accessibilityLabel={`${role}, ${DEVICE_KIND}, ${s.businessName ?? "no location"}, ${reachLabel}, Surge POS ${APP_VERSION}`}>
        {role} · {DEVICE_KIND} · {s.businessName ?? "No location"} · <Text style={{ color: reachTint }}>{reachLabel}</Text> · Surge POS {APP_VERSION}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  mark: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.control, backgroundColor: color.blue },
  markTxt: { fontFamily: fontFamily.semibold, fontSize: 14, letterSpacing: 3, color: color.onPrimary },

  rolePicker: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // Was 40pt — under Apple's 44pt HIG floor AND under this product's own
  // touch.min of 48, on the control that decides what the terminal IS.
  rolePill: { minHeight: touch.min, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  rolePillOn: { borderColor: color.blue, backgroundColor: color.blue },
  rolePillTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  rolePillTxtOn: { color: color.onPrimary, fontFamily: fontFamily.semibold },

  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.lg },
  role: { fontFamily: fontFamily.semibold, fontSize: fontSize.display, color: color.text, textAlign: "center" },

  // 380: unchanged from before this pass, and still the widest of the three
  // terminals measured. 3 keys × ~110 + 2 × 8pt gutters + 2 × 16pt padding.
  card: { width: 380, maxWidth: "100%", backgroundColor: color.card, borderRadius: radius.tile, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.md },
  head: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text, textAlign: "center" },
  headErr: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.late, textAlign: "center" },
  headOk: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.success, textAlign: "center" },

  input: { minHeight: touch.min, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, color: color.text, fontFamily: fontFamily.regular, fontSize: fontSize.body },
  bizRow: { minHeight: touch.min + 4, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  err: { color: color.late, fontSize: fontSize.caption, fontFamily: fontFamily.medium },
  pinDots: { color: color.text, fontSize: 32, letterSpacing: 10, textAlign: "center" },

  stateLine: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: color.textFaint, textAlign: "center", paddingHorizontal: space.lg, paddingBottom: space.sm },
});
