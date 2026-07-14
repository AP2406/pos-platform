import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, BottomSheet, color, radius, space, text } from "@/design";
import { useSession } from "@/state/session";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchReservations, type ReservationRow } from "@/lib/reads";
import { reservationMutate, createReservation } from "@/lib/api";
import { formatElapsed } from "@/lib/format";

// Small +/- stepper for party size and quoted wait.
function Stepper({ label, value, onChange, min, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; step?: number; suffix?: string }) {
  return (
    <View style={styles.stepRow}>
      <Text style={text.body}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn} hitSlop={8}>
          <Text style={styles.stepGlyph}>−</Text>
        </Pressable>
        <Text style={styles.stepVal}>
          {value}
          {suffix ?? ""}
        </Text>
        <Pressable onPress={() => onChange(value + step)} style={styles.stepBtn} hitSlop={8}>
          <Text style={styles.stepGlyph}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Waitlist() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;

  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [wait, setWait] = useState(15);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchReservations(bizId));
    } catch {
      /* transient */
    }
  }, [bizId]);

  useEffect(() => {
    setNow(Date.now());
    load();
    const channel = realtimeChannel("waitlist-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: "business_id=eq." + bizId }, () => load())
      .subscribe();
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [bizId, load]);

  // Walk-ins only (no scheduled time). Bookings live on the Reservations screen.
  const waiting = useMemo(
    () => rows.filter((r) => r.scheduledAt == null).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [rows]
  );

  async function mutate(id: string, op: "page" | "seat" | "remove") {
    setBusyId(id);
    try {
      if (op === "page") {
        const res = await reservationMutate(bizId, staffId, id, { op: "page" });
        Alert.alert("Guest paged", res.channel === "sms" ? "Texted them their table is ready." : "Emailed them their table is ready.");
      } else {
        await reservationMutate(bizId, staffId, id, { op: "status", status: op === "seat" ? "seated" : "cancelled" });
      }
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function addWalkIn() {
    if (!name.trim()) {
      Alert.alert("Enter a guest name.");
      return;
    }
    setSaving(true);
    try {
      await createReservation(bizId, staffId, { guestName: name, partySize: party, phone: phone || null, quotedWaitMin: wait });
      setAdding(false);
      setName("");
      setPhone("");
      setParty(2);
      setWait(15);
    } catch (e) {
      Alert.alert("Couldn't add to waitlist", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSaving(false);
      load();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/floor")} hitSlop={12}>
          <Text style={text.bodyDim}>‹ Floor</Text>
        </Pressable>
        <Text style={styles.title}>Waitlist</Text>
        <View style={{ flex: 1 }} />
        <Button title="Reservations" variant="ghost" onPress={() => router.replace("/reservations")} />
        <Button title="Add" onPress={() => setAdding(true)} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {waiting.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>Nobody waiting.</Text>}
        {waiting.map((r, i) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.pos}>{i + 1}</Text>
            <View style={styles.main}>
              <Text style={styles.name}>
                {r.guestName} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
              </Text>
              <Text style={styles.sub}>
                Waiting {formatElapsed(r.createdAt, now)}
                {r.quotedWaitMin != null ? " · quoted " + r.quotedWaitMin + "m" : ""}
                {r.pagedAt ? " · paged" : ""}
                {r.status === "seated" ? " · seated" : ""}
              </Text>
            </View>
            <View style={styles.actions}>
              {r.status !== "seated" && (r.phone || r.email) ? (
                <Button title={r.pagedAt ? "Re-page" : "Page"} variant="secondary" loading={busyId === r.id} onPress={() => mutate(r.id, "page")} />
              ) : null}
              {r.status !== "seated" ? <Button title="Seat" loading={busyId === r.id} onPress={() => mutate(r.id, "seat")} /> : null}
              <Button title="✕" variant="ghost" onPress={() => mutate(r.id, "remove")} />
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title="Add walk-in">
        <TextInput value={name} onChangeText={setName} placeholder="Guest name" placeholderTextColor={color.textFaint} style={styles.input} autoFocus />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone (for the ready text)" placeholderTextColor={color.textFaint} style={styles.input} keyboardType="phone-pad" />
        <Stepper label="Party size" value={party} onChange={setParty} min={1} />
        <Stepper label="Quoted wait" value={wait} onChange={setWait} min={0} step={5} suffix="m" />
        <Button title="Add to waitlist" loading={saving} onPress={addWalkIn} />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  list: { padding: space.lg, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  pos: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.textDim, minWidth: 20, textAlign: "center" },
  main: { flex: 1 },
  name: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  sub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
  input: { backgroundColor: color.card2, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 15 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center", backgroundColor: color.card2 },
  stepGlyph: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  stepVal: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.text, minWidth: 44, textAlign: "center" },
});
