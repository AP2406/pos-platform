import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalendarCheck, Users, Phone } from "lucide-react-native";
import { Button, ScreenHeader, EmptyState, StatusChip, color, space, radius } from "@/design";
import { useSession } from "@/state/session";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchReservations, type ReservationRow } from "@/lib/reads";
import { reservationMutate } from "@/lib/api";
import type { ReservationStatus } from "@surge/api-contracts";

const whenOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function Reservations() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;

  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchReservations(bizId));
    } catch {
      /* transient */
    }
  }, [bizId]);

  useEffect(() => {
    load();
    const channel = realtimeChannel("reservations-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: "business_id=eq." + bizId }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bizId, load]);

  // Future bookings only (walk-ins live on the Waitlist screen).
  const bookings = useMemo(
    () => rows.filter((r) => r.scheduledAt != null).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [rows]
  );

  async function setStatus(id: string, status: ReservationStatus) {
    setBusyId(id);
    try {
      await reservationMutate(bizId, staffId, id, { op: "status", status });
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusyId(null);
      load();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Reservations" subtitle={bookings.length > 0 ? bookings.length + " upcoming" : undefined} onBack={() => router.replace("/floor")} right={<Button title="Waitlist" variant="ghost" onPress={() => router.replace("/waitlist")} />} />

      <ScrollView contentContainerStyle={styles.list}>
        {bookings.length === 0 && (
          <EmptyState
            icon={<CalendarCheck size={26} color={color.textDim} strokeWidth={2} />}
            title="No upcoming reservations"
            body="Bookings made online or in the Surge web dashboard show here in time order, ready to seat."
            actionLabel="Open the waitlist"
            onAction={() => router.replace("/waitlist")}
          />
        )}
        {bookings.map((r) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.when}>
              <Text style={styles.whenTxt}>{whenOf(r.scheduledAt!)}</Text>
            </View>
            <View style={styles.main}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.guestName}
                </Text>
                {r.status === "seated" ? <StatusChip tint={color.success} label="Seated" size="sm" /> : null}
              </View>
              <View style={styles.metaRow}>
                <Users size={14} color={color.textDim} strokeWidth={2.25} />
                <Text style={styles.sub}>{r.partySize + (r.partySize === 1 ? " guest" : " guests")}</Text>
                {r.phone ? (
                  <>
                    <Phone size={14} color={color.textDim} strokeWidth={2.25} style={{ marginLeft: space.sm }} />
                    <Text style={styles.sub}>{r.phone}</Text>
                  </>
                ) : null}
              </View>
              {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
            </View>
            <View style={styles.actions}>
              {r.status === "seated" ? (
                <Button title="Done" variant="secondary" loading={busyId === r.id} onPress={() => setStatus(r.id, "done")} />
              ) : (
                <>
                  <Button title="Seat" loading={busyId === r.id} onPress={() => setStatus(r.id, "seated")} />
                  <Button title="No-show" variant="ghost" onPress={() => setStatus(r.id, "no_show")} />
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72 },
  when: { minWidth: 96, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.control, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, alignItems: "center" },
  whenTxt: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: color.text, textAlign: "center" },
  main: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flexShrink: 1, fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sub: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  notes: { fontFamily: "Poppins_400Regular", fontSize: 14, color: color.textDim, marginTop: 2, fontStyle: "italic" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
