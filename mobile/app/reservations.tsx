import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, ScreenHeader, EmptyState, color, space, text } from "@/design";
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
      <ScreenHeader title="Reservations" onBack={() => router.replace("/floor")} right={<Button title="Waitlist" variant="ghost" onPress={() => router.replace("/waitlist")} />} />

      <ScrollView contentContainerStyle={styles.list}>
        {bookings.length === 0 && <EmptyState>No upcoming reservations.</EmptyState>}
        {bookings.map((r) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.main}>
              <Text style={styles.name}>
                {r.guestName} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
              </Text>
              <Text style={styles.sub}>
                {whenOf(r.scheduledAt!)}
                {r.status === "seated" ? " · Seated" : ""}
                {r.phone ? " · " + r.phone : ""}
              </Text>
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
  list: { padding: space.lg, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  main: { flex: 1 },
  name: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  sub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  notes: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 2, fontStyle: "italic" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
