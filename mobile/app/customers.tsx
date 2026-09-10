import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Users } from "lucide-react-native";
import { SearchField, ScreenHeader, EmptyState, color, space, radius } from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { fetchCustomers, type CustomerRow } from "@/lib/reads";

export default function Customers() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;

  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);

  const load = useCallback(
    async (t: string) => {
      try {
        setRows(await fetchCustomers(bizId, t));
      } catch {
        notify("Couldn't load the latest — check your connection.");
      }
    },
    [bizId]
  );

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => load(term), 250);
    return () => clearTimeout(id);
  }, [term, load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Customers" onBack={() => router.replace("/floor")} />

      <View style={styles.searchWrap}>
        <SearchField value={term} onChangeText={setTerm} placeholder="Search by name, phone or email" />
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {rows.length === 0 && (
          <EmptyState
            icon={<Users size={26} color={color.textDim} strokeWidth={2} />}
            title={term ? "No customers match" : "No customer profiles yet"}
            body={term ? "Try a different spelling, or the last four digits of their phone number." : "Profiles are created when a guest is attached to a check, joins loyalty, or books a reservation."}
            actionLabel={term ? "Clear search" : undefined}
            onAction={term ? () => setTerm("") : undefined}
          />
        )}
        {rows.map((c) => (
          <Pressable key={c.id} style={styles.row} onPress={() => router.push({ pathname: "/customers/[id]", params: { id: c.id } })}>
            <View style={styles.main}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.sub}>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact on file"}</Text>
            </View>
            <ChevronRight size={20} color={color.textFaint} strokeWidth={2.25} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  searchWrap: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  main: { flex: 1, gap: 2 },
  name: { fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
  sub: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
});
