import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SearchField, BottomSheet, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { fetchCustomers, fetchCustomerDetail, type CustomerRow, type CustomerDetail } from "@/lib/reads";
import { money } from "@/lib/format";

const dateOf = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export default function Customers() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;

  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(
    async (t: string) => {
      try {
        setRows(await fetchCustomers(bizId, t));
      } catch {
        /* transient */
      }
    },
    [bizId]
  );

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => load(term), 250);
    return () => clearTimeout(id);
  }, [term, load]);

  async function open(id: string) {
    setLoadingDetail(true);
    setDetail(null);
    try {
      setDetail(await fetchCustomerDetail(bizId, id));
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/floor")} hitSlop={12}>
          <Text style={text.bodyDim}>‹ Floor</Text>
        </Pressable>
        <Text style={styles.title}>Customers</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchField value={term} onChangeText={setTerm} placeholder="Search name, phone, or email" />
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {rows.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>{term ? "No matches." : "No customers yet."}</Text>}
        {rows.map((c) => (
          <Pressable key={c.id} style={styles.row} onPress={() => open(c.id)}>
            <View style={styles.main}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.sub}>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact on file"}</Text>
            </View>
            <Text style={text.bodyDim}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      <BottomSheet visible={loadingDetail || !!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Loading…"}>
        {detail ? (
          <>
            <Text style={text.bodyDim}>{[detail.phone, detail.email].filter(Boolean).join(" · ") || "No contact on file"}</Text>
            <View style={styles.stats}>
              <Stat label="Visits" value={String(detail.visits)} />
              <Stat label="Loyalty" value={detail.loyaltyPoints == null ? "—" : detail.loyaltyPoints + " pts"} />
              <Stat label="Credit" value={money(detail.storeCredit, "CAD")} />
            </View>
            <Text style={text.caption}>{detail.lastVisit ? "Last visit " + dateOf(detail.lastVisit) : "No visits yet"}</Text>
            {detail.notes ? <Text style={[text.body, { marginTop: space.xs }]}>{detail.notes}</Text> : null}
          </>
        ) : (
          <Text style={text.bodyDim}>Loading…</Text>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  searchWrap: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  list: { padding: space.lg, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  main: { flex: 1 },
  name: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  sub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  stats: { flexDirection: "row", gap: space.sm, marginVertical: space.sm },
  stat: { flex: 1, backgroundColor: color.card2, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingVertical: space.sm, alignItems: "center", gap: 2 },
  statVal: { fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
});
