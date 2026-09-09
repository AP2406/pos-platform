import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, ClipboardList, Plus, Bell } from "lucide-react-native";
import { Button, BottomSheet, ScreenHeader, EmptyState, StatusChip, color, radius, space, text } from "@/design";
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
        Alert.alert("Guest notified", res.channel === "sms" ? "We texted them that their table is ready." : "We emailed them that their table is ready.");
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
      <ScreenHeader
        title="Waitlist"
        subtitle={waiting.length > 0 ? waiting.length + " waiting" : undefined}
        onBack={() => router.replace("/floor")}
        right={
          <>
            <Button title="Reservations" variant="ghost" onPress={() => router.replace("/reservations")} />
            <Button title="Add walk-in" icon={<Plus size={18} color={color.onPrimary} strokeWidth={2.5} />} onPress={() => setAdding(true)} />
          </>
        }
      />

      <ScrollView contentContainerStyle={styles.list}>
        {waiting.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={26} color={color.textDim} strokeWidth={2} />}
            title="Nobody is waiting"
            body="Add walk-in parties here, quote a wait, and text them when their table is ready."
            actionLabel="Add walk-in"
            onAction={() => setAdding(true)}
          />
        )}
        {waiting.map((r, i) => {
          const waitedMin = Math.floor((now - new Date(r.createdAt).getTime()) / 60000);
          const over = r.quotedWaitMin != null && now > 0 && waitedMin > r.quotedWaitMin;
          return (
            <View key={r.id} style={styles.row}>
              <View style={styles.posBox}>
                <Text style={styles.pos}>{i + 1}</Text>
              </View>
              <View style={styles.main}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.guestName} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
                  </Text>
                  {r.status === "seated" ? <StatusChip tint={color.success} label="Seated" size="sm" /> : r.pagedAt ? <StatusChip tint={color.blue} label="Texted" size="sm" /> : over ? <StatusChip tint={color.warning} label="Over quote" size="sm" /> : null}
                </View>
                <Text style={[styles.sub, over && { color: color.warning }]}>
                  Waiting {formatElapsed(r.createdAt, now)}
                  {r.quotedWaitMin != null ? " · quoted " + r.quotedWaitMin + " min" : ""}
                  {!r.phone && !r.email ? " · no phone on file" : ""}
                </Text>
              </View>
              <View style={styles.actions}>
                {r.status !== "seated" && (r.phone || r.email) ? (
                  <Button title={r.pagedAt ? "Text again" : "Text guest"} variant="secondary" icon={<Bell size={16} color={color.text} strokeWidth={2} />} loading={busyId === r.id} onPress={() => mutate(r.id, "page")} />
                ) : null}
                {r.status !== "seated" ? <Button title="Seat" variant="success" loading={busyId === r.id} onPress={() => mutate(r.id, "seat")} /> : null}
                <Pressable onPress={() => mutate(r.id, "remove")} style={styles.remove} hitSlop={6} accessibilityRole="button" accessibilityLabel={"Remove " + r.guestName + " from the waitlist"}>
                  <X size={20} color={color.textDim} strokeWidth={2.25} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title="Add walk-in">
        <TextInput value={name} onChangeText={setName} placeholder="Guest name" placeholderTextColor={color.textFaint} style={styles.input} autoFocus />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Mobile number — we'll text when the table's ready" placeholderTextColor={color.textFaint} style={styles.input} keyboardType="phone-pad" />
        <Stepper label="Party size" value={party} onChange={setParty} min={1} />
        <Stepper label="Quoted wait" value={wait} onChange={setWait} min={0} step={5} suffix="m" />
        <Button title="Add to waitlist" size="lg" loading={saving} onPress={addWalkIn} />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72 },
  posBox: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  pos: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.text },
  main: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flexShrink: 1, fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
  sub: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  input: { minHeight: 48, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 16 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center", backgroundColor: color.card2 },
  stepGlyph: { fontFamily: "Poppins_600SemiBold", fontSize: 22, color: color.text },
  stepVal: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text, minWidth: 56, textAlign: "center" },
});
