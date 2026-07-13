import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SegmentedTabs, SearchField, TableCard, Button, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { supabase } from "@/lib/supabase";
import { fetchOpenChecks, type OpenCheck } from "@/lib/reads";
import { formatElapsed, minutesSince } from "@/lib/format";

type Tab = "all" | "tables" | "bar" | "togo";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tables", label: "Tables" },
  { key: "bar", label: "Bar tabs" },
  { key: "togo", label: "To-go" },
];

function inTab(c: OpenCheck, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "tables") return c.ticketType === "table";
  if (tab === "bar") return c.ticketType === "bar";
  return c.ticketType === "togo" || !!c.channel;
}

export default function Floor() {
  const s = useSession();
  const router = useRouter();
  const [checks, setChecks] = useState<OpenCheck[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    if (!s.businessId) return;
    try {
      setChecks(await fetchOpenChecks(s.businessId));
    } catch {
      /* transient — realtime/interval will retry */
    }
  }, [s.businessId]);

  useEffect(() => {
    if (!s.businessId) return;
    setNow(Date.now());
    load();
    const channel = supabase
      .channel("floor-" + s.businessId)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + s.businessId }, () => load())
      .subscribe();
    const iv = setInterval(() => {
      setNow(Date.now());
      load();
    }, 30000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [s.businessId, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return checks
      .filter((c) => inTab(c, tab))
      .filter((c) => !q || c.label.toLowerCase().includes(q) || (c.customerPhone ?? "").toLowerCase().includes(q));
  }, [checks, tab, query]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={text.title}>Floor</Text>
          <Text style={text.caption}>
            {s.businessName} · {s.staff?.name}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="New tab" variant="secondary" onPress={() => router.push("/register?mode=tab")} />
          <Button title="New to-go" onPress={() => router.push("/register?mode=togo")} />
        </View>
      </View>

      <View style={styles.controls}>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
        <SearchField value={query} onChangeText={setQuery} placeholder="Find a check — name or phone" />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {visible.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>No open checks.</Text>}
        {visible.map((c) => {
          const mins = minutesSince(c.openedAt, now);
          return (
            <TableCard
              key={c.id}
              label={c.label}
              sub={c.guests > 0 ? c.guests + " guests" : c.channel ?? c.ticketType ?? undefined}
              minutes={mins}
              elapsedLabel={c.checkDropped ? "check dropped" : formatElapsed(c.openedAt, now)}
              checkDropped={c.checkDropped}
              onPress={() => router.push({ pathname: "/register", params: { ticket: c.id } })}
            />
          );
        })}
      </ScrollView>

      <Pressable onPress={s.signOut} style={styles.signout}>
        <Text style={text.caption}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.xl, paddingBottom: space.md },
  actions: { flexDirection: "row", gap: space.sm },
  controls: { paddingHorizontal: space.xl, gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
  signout: { alignItems: "center", padding: space.md },
});
