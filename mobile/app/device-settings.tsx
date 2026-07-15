import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, ScreenHeader, EmptyState, color, radius, space, text } from "@/design";
import { useSession } from "@/state/session";
import { isManager, DEVICE_STATIONS, type DeviceStation } from "@/lib/access";
import { PRINTER_TARGETS, type DeviceProfile } from "@/lib/device-profile";
import { fetchFloorPlans, type FloorPlan } from "@/lib/reads";

// A row of selectable chips (single-select). `value === current` highlights.
function Choices<T extends string | null>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DeviceSettings() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const manager = isManager(s.staff?.role ?? "");

  const [draft, setDraft] = useState<DeviceProfile>(s.deviceProfile);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [saved, setSaved] = useState(true);

  // Re-seed if the stored profile changes (e.g. first async load after mount).
  useEffect(() => {
    setDraft(s.deviceProfile);
  }, [s.deviceProfile]);

  useEffect(() => {
    fetchFloorPlans(bizId).then(setPlans).catch(() => {});
  }, [bizId]);

  function patch(fields: Partial<DeviceProfile>) {
    setDraft((d) => ({ ...d, ...fields }));
    setSaved(false);
  }

  function save() {
    s.setDeviceProfile(draft);
    setSaved(true);
    Alert.alert("Saved", "This device's profile was updated." + (draft.station ? " Screen access now follows the " + (DEVICE_STATIONS.find((x) => x.key === draft.station)?.label ?? draft.station) + " station." : ""));
  }

  const stationOptions: { key: DeviceStation | null; label: string }[] = [{ key: null, label: "Role-based" }, ...DEVICE_STATIONS];
  const planOptions: { key: string | null; label: string }[] = [{ key: null, label: "First room" }, ...plans.map((p) => ({ key: p.id, label: p.name }))];
  const printerOptions = PRINTER_TARGETS.map((t) => ({ key: t.id, label: t.label }));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Device settings" onBack={() => router.replace("/floor")} />

      {!manager ? (
        <EmptyState>Device settings are limited to an owner or manager.</EmptyState>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Device name</Text>
            <TextInput value={draft.label} onChangeText={(t) => patch({ label: t })} placeholder="e.g. Bar iPad" placeholderTextColor={color.textFaint} style={styles.input} maxLength={40} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Station</Text>
            <Text style={styles.help}>Sets what this device shows for anyone signed in. Role-based leaves each staff member's own access.</Text>
            <Choices options={stationOptions} value={draft.station} onChange={(station) => patch({ station })} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Default room</Text>
            <Text style={styles.help}>The Floor opens to this room on this device.</Text>
            <Choices options={planOptions} value={draft.defaultPlanId} onChange={(defaultPlanId) => patch({ defaultPlanId })} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Printer</Text>
            <Text style={styles.help}>Native receipt/kitchen printing is deferred — this saves the target but binds no hardware yet.</Text>
            <Choices options={printerOptions} value={draft.printerTarget ?? "none"} onChange={(printerTarget) => patch({ printerTarget: printerTarget === "none" ? null : printerTarget })} />
          </View>

          <Button title={saved ? "Saved" : "Save device profile"} onPress={save} disabled={saved} />
          <Text style={[text.caption, { textAlign: "center" }]}>Stored on this device only. Money settings are unaffected.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md, maxWidth: 560, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.sm },
  cardLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text },
  help: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: -space.xs },
  input: { backgroundColor: color.card2, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2 },
  chipOn: { borderColor: color.blue, backgroundColor: color.card },
  chipTxt: { fontFamily: "Poppins_500Medium", fontSize: 13, color: color.textDim },
  chipTxtOn: { color: color.text },
});
