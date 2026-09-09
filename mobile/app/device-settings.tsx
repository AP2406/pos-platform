import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Printer, Wifi, WifiOff, Check, LockKeyhole, FlaskConical, TimerReset } from "lucide-react-native";
import { Button, ScreenHeader, EmptyState, StatusChip, color, radius, space, text } from "@/design";
import { useSession } from "@/state/session";
import { isManager, DEVICE_STATIONS, type DeviceStation } from "@/lib/access";
import { PRINTER_TARGETS, LOCK_OPTIONS, DEFAULT_LOCK_MIN, BACKGROUND_LOCK_MIN, type DeviceProfile } from "@/lib/device-profile";
import { fetchFloorPlans, type FloorPlan } from "@/lib/reads";
import { printerStatus, printTestPage } from "@/lib/printing";
import { DEMO_AVAILABLE } from "@/lib/demo/state";

// A row of selectable chips (single-select). `value === current` highlights.
function Choices<T extends string | number | null>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
            {on ? <Check size={14} color={color.onPrimary} strokeWidth={3} /> : null}
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
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  // Re-seed if the stored profile changes (e.g. first async load after mount).
  useEffect(() => {
    setDraft(s.deviceProfile);
  }, [s.deviceProfile]);

  useEffect(() => {
    fetchFloorPlans(bizId).then(setPlans).catch(() => {});
  }, [bizId]);

  // "Saved just now" relaxes back to a plain confirmation after a moment.
  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  function patch(fields: Partial<DeviceProfile>) {
    setDraft((d) => ({ ...d, ...fields }));
    setDirty(true);
  }

  function save() {
    s.setDeviceProfile(draft);
    setDirty(false);
    setSavedAt(Date.now());
  }

  async function testPrint() {
    if (testing) return;
    setTesting(true);
    try {
      const res = await printTestPage(draft.printerTarget, s.businessName ?? "Surge");
      if (!res.ok) Alert.alert("Couldn't print", res.error);
      else if (res.printed) Alert.alert("Test page sent", "Check the printer for a short test slip.");
      else Alert.alert("Printer not connected", "This iPad can't reach the printer yet. Make sure it's powered on and on the same Wi-Fi network, then try again.");
    } finally {
      setTesting(false);
    }
  }

  const stationOptions: { key: DeviceStation | null; label: string }[] = [{ key: null, label: "Follow each person's role" }, ...DEVICE_STATIONS];
  const planOptions: { key: string | null; label: string }[] = [{ key: null, label: "First room" }, ...plans.map((p) => ({ key: p.id, label: p.name }))];
  const printerOptions = PRINTER_TARGETS.map((t) => ({ key: t.id, label: t.label }));
  const pStatus = printerStatus(draft.printerTarget);
  const printerName = PRINTER_TARGETS.find((t) => t.id === draft.printerTarget)?.label ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Device settings" subtitle="This iPad" onBack={() => router.replace("/floor")} />

      {!manager ? (
        <EmptyState
          icon={<LockKeyhole size={26} color={color.textDim} strokeWidth={2} />}
          title="Managers only"
          body="Device settings change what this iPad shows for everyone who signs in, so they're limited to owners and managers."
          actionLabel="Back to Floor"
          onAction={() => router.replace("/floor")}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Device name</Text>
            <Text style={styles.help}>How this iPad shows up in reports and on kitchen tickets.</Text>
            <TextInput value={draft.label} onChangeText={(t) => patch({ label: t })} placeholder="e.g. Bar iPad, Host stand" placeholderTextColor={color.textFaint} style={styles.input} maxLength={40} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Station</Text>
            <Text style={styles.help}>Pin this iPad to one job — the kitchen screen, for example — for anyone who signs in.</Text>
            <Choices options={stationOptions} value={draft.station} onChange={(station) => patch({ station })} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Default room</Text>
            <Text style={styles.help}>The Floor opens to this room on this iPad.</Text>
            <Choices options={planOptions} value={draft.defaultPlanId} onChange={(defaultPlanId) => patch({ defaultPlanId })} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Auto-lock</Text>
                <Text style={styles.help}>
                  {draft.station === "kitchen"
                    ? "Kitchen screens are shared, so this iPad stays unlocked."
                    : "Return to the staff PIN pad after the iPad sits untouched — and after it's been put away for " + BACKGROUND_LOCK_MIN + " minutes. Staff stay signed in through quick reloads."}
                </Text>
              </View>
              <TimerReset size={22} color={color.textDim} strokeWidth={2} />
            </View>
            {draft.station !== "kitchen" ? <Choices options={LOCK_OPTIONS} value={draft.lockAfterMin ?? DEFAULT_LOCK_MIN} onChange={(lockAfterMin) => patch({ lockAfterMin })} /> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Printer</Text>
                <Text style={styles.help}>Receipts, checks and kitchen tickets from this iPad print here.</Text>
              </View>
              {pStatus === "connected" ? <StatusChip tint={color.success} label="Connected" /> : pStatus === "not_connected" ? <StatusChip tint={color.warning} label="Not connected" /> : <StatusChip tint={color.textDim} label="No printer" />}
            </View>
            <Choices options={printerOptions} value={draft.printerTarget ?? "none"} onChange={(printerTarget) => patch({ printerTarget: printerTarget === "none" ? null : printerTarget })} />
            {draft.printerTarget ? (
              <View style={[styles.status, { borderColor: pStatus === "connected" ? color.success : color.warning }]}>
                {pStatus === "connected" ? <Wifi size={20} color={color.success} strokeWidth={2} /> : <WifiOff size={20} color={color.warning} strokeWidth={2} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.statusTitle}>{printerName}</Text>
                  <Text style={styles.statusBody}>
                    {pStatus === "connected" ? "Ready to print from this iPad." : "Saved, but this iPad can't reach it yet. Power the printer on and join it to the same Wi-Fi, then send a test page."}
                  </Text>
                </View>
                <Button title="Test print" variant="secondary" icon={<Printer size={18} color={color.text} strokeWidth={2} />} onPress={testPrint} loading={testing} />
              </View>
            ) : null}
          </View>

          {DEMO_AVAILABLE ? (
            <View style={[styles.card, styles.demoCard]}>
              <View style={styles.cardHead}>
                <View style={styles.demoIcon}>
                  <FlaskConical size={20} color={color.warning} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>Demo restaurant</Text>
                  <Text style={styles.help}>Fills every screen with a realistic evening of service — live tables, kitchen tickets, orders, reservations and 30 days of sales — using this room's real floor plan. Nothing is saved to your account. Development builds only.</Text>
                </View>
                <Switch value={draft.demoMode === true} onValueChange={(demoMode) => patch({ demoMode })} trackColor={{ true: color.warning, false: color.border }} thumbColor="#FFFFFF" accessibilityLabel="Demo restaurant mode" />
              </View>
            </View>
          ) : null}

          <View style={styles.saveRow}>
            <Button title={dirty ? "Save changes" : savedAt != null ? "Saved just now" : "Saved"} variant={dirty ? "primary" : "secondary"} size="lg" icon={!dirty ? <Check size={18} color={color.text} strokeWidth={2.5} /> : undefined} onPress={save} disabled={!dirty} style={{ flex: 1 }} />
          </View>
          <Text style={[text.caption, { textAlign: "center" }]}>Settings are stored on this iPad only and don't affect your menu, prices or taxes.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  cardLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text },
  help: { fontFamily: "Poppins_400Regular", fontSize: 14, color: color.textDim, marginTop: 2 },
  input: { minHeight: 48, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2 },
  chipOn: { borderColor: color.blue, backgroundColor: color.blue },
  chipTxt: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.textDim },
  chipTxtOn: { color: color.onPrimary, fontFamily: "Poppins_600SemiBold" },
  status: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, backgroundColor: color.card2 },
  statusTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text },
  statusBody: { fontFamily: "Poppins_400Regular", fontSize: 13, color: color.textDim },
  saveRow: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  demoCard: { borderColor: color.warning, backgroundColor: color.warningSoft },
  demoIcon: { width: 40, height: 40, borderRadius: radius.control, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
});
