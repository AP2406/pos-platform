import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Clock as ClockIcon, Coffee } from "lucide-react-native";
import { Button, ScreenHeader, EmptyState, StatusChip, color, space, text, radius } from "@/design";
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
              size="lg"
              style={{ marginBottom: space.sm }}
            />
            {mine.onShift && (
              <Button
                title={mine.onBreak ? "End break" : "Start break"}
                variant="secondary"
                icon={<Coffee size={18} color={color.text} strokeWidth={2} />}
                loading={busy === "break"}
                disabled={busy === "toggle"}
                onPress={() => act("break")}
              />
            )}
          </View>
        ) : (
          <EmptyState icon={<ClockIcon size={26} color={color.textDim} strokeWidth={2} />} title="Sign in with your PIN to clock in" body="The time clock records shifts for the person signed in on this iPad." />
        )}

        <Text style={text.eyebrow}>On the clock · {roster.length}</Text>
        {roster.length === 0 && <EmptyState compact title="Nobody is clocked in" body="Team members appear here as soon as they clock in on any device." />}
        {roster.map((r) => (
          <View key={r.staffId} style={styles.row}>
            <Text style={styles.rowName}>{r.name}</Text>
            {r.onBreakSince ? <StatusChip tint={color.warning} label="On break" size="sm" /> : <StatusChip tint={color.success} label="Working" size="sm" />}
            <Text style={styles.rowTime}>{formatElapsed(r.since, now)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.sm, maxWidth: 640, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: radius.tile, borderWidth: 1, borderColor: color.border, padding: space.xl, marginBottom: space.md },
  name: { fontFamily: "Poppins_600SemiBold", fontSize: 22, color: color.text, marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60 },
  rowName: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 16, color: color.text },
  rowTime: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.textDim, fontVariant: ["tabular-nums"], minWidth: 64, textAlign: "right" },
});
