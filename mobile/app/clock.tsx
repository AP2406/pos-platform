import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, ScreenHeader, EmptyState, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchMyShift, fetchOnShift, type MyShift, type OnShiftRow } from "@/lib/reads";
import { clockToggle } from "@/lib/api";
import { formatElapsed } from "@/lib/format";

const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function Clock() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;

  const [mine, setMine] = useState<MyShift>({ onShift: false, onBreak: false, since: null, onBreakSince: null });
  const [roster, setRoster] = useState<OnShiftRow[]>([]);
  const [busy, setBusy] = useState<null | "toggle" | "break">(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([staffId ? fetchMyShift(bizId, staffId) : Promise.resolve<MyShift>({ onShift: false, onBreak: false, since: null, onBreakSince: null }), fetchOnShift(bizId)]);
      setMine(m);
      setRoster(r);
    } catch {
      /* transient */
    }
  }, [bizId, staffId]);

  useEffect(() => {
    setNow(Date.now());
    load();
    const channel = realtimeChannel("clock-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_clock_entries", filter: "business_id=eq." + bizId }, () => load())
      .subscribe();
    const iv = setInterval(() => {
      setNow(Date.now());
      load();
    }, 30000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [bizId, load]);

  async function act(op: "toggle" | "break") {
    if (!staffId) return;
    setBusy(op);
    try {
      const res = await clockToggle(bizId, staffId, op);
      setMine({ onShift: res.onShift, onBreak: res.onBreak, since: res.since, onBreakSince: res.onBreakSince });
      const msg =
        res.action === "in" ? "Clocked in" : res.action === "out" ? "Clocked out" : res.action === "break_start" ? "Break started" : "Break ended";
      Alert.alert(msg, res.name);
    } catch (e) {
      Alert.alert("Couldn't update the clock", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(null);
      load();
    }
  }

  const statusLine = !mine.onShift
    ? "You're off the clock."
    : mine.onBreak
    ? `On break ${formatElapsed(mine.onBreakSince, now)} · shift since ${mine.since ? timeOf(mine.since) : ""}`
    : `On shift ${formatElapsed(mine.since, now)} · since ${mine.since ? timeOf(mine.since) : ""}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Time clock" onBack={() => router.replace("/floor")} />

      <ScrollView contentContainerStyle={styles.body}>
        {staffId ? (
          <View style={styles.card}>
            <Text style={styles.name}>{s.staff?.name}</Text>
            <Text style={[text.bodyDim, { marginBottom: space.md }]}>{statusLine}</Text>
            <Button
              title={mine.onShift ? "Clock out" : "Clock in"}
              variant={mine.onShift ? "danger" : "primary"}
              loading={busy === "toggle"}
              disabled={busy === "break"}
              onPress={() => act("toggle")}
              style={{ marginBottom: space.sm }}
            />
            {mine.onShift && (
              <Button
                title={mine.onBreak ? "End break" : "Start break"}
                variant="secondary"
                loading={busy === "break"}
                disabled={busy === "toggle"}
                onPress={() => act("break")}
              />
            )}
          </View>
        ) : (
          <EmptyState>No acting staff on this device.</EmptyState>
        )}

        <Text style={styles.section}>On the clock ({roster.length})</Text>
        {roster.length === 0 && <EmptyState>Nobody is clocked in.</EmptyState>}
        {roster.map((r) => (
          <View key={r.staffId} style={styles.row}>
            <Text style={styles.rowName}>{r.name}</Text>
            <Text style={text.caption}>
              {r.onBreakSince ? "On break · " : ""}
              {formatElapsed(r.since, now)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.sm },
  card: { backgroundColor: color.card, borderRadius: 16, borderWidth: 1, borderColor: color.border, padding: space.lg, marginBottom: space.md },
  name: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text, marginBottom: space.xs },
  section: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: color.textDim, marginTop: space.sm, marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  rowName: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
});
