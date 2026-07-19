import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeType } from "expo-camera";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";
import { Button } from "./Button";

// The register handles the lookup + add and returns feedback so the sheet can show
// inline "Added ✓ / no match" without closing — keeps scanning continuous.
export type ScanResult = { found: boolean; name?: string; message?: string };

const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"];
const DEBOUNCE_MS = 1500;

// Full-screen scanner. Live camera when permitted; a manual/typed field always
// available so a USB/Bluetooth wedge scanner (or manual key) works even without
// camera access. Money-independent (adds catalog items to the order).
export function ScanSheet({ visible, onClose, onCode }: { visible: boolean; onClose: () => void; onCode: (code: string) => ScanResult }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState<{ text: string; ok: boolean } | null>(null);
  const [count, setCount] = useState(0);
  const [manual, setManual] = useState("");
  const recent = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) requestPermission();
    if (!visible) {
      setLast(null);
      setCount(0);
      setManual("");
    }
  }, [visible, permission, requestPermission]);

  function handle(raw: string) {
    const code = (raw ?? "").trim();
    if (!code) return;
    const now = Date.now();
    // Ignore the same code re-fired within the debounce window (camera scans continuously).
    if (code === recent.current.code && now - recent.current.at < DEBOUNCE_MS) return;
    recent.current = { code, at: now };
    const res = onCode(code);
    if (res.found) {
      setLast({ text: "Added " + (res.name ?? code), ok: true });
      setCount((c) => c + 1);
    } else {
      setLast({ text: res.message ?? "No item for " + code, ok: false });
    }
  }

  const canScan = !!permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {canScan ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={({ data }) => handle(data)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noCam]}>
            <Text style={styles.noCamTitle}>Camera unavailable</Text>
            <Text style={styles.noCamBody}>
              {permission && !permission.canAskAgain ? "Enable camera access in Settings, or scan/type a barcode below." : "Grant camera access to scan, or type/scan a barcode below."}
            </Text>
            {permission && permission.canAskAgain ? <Button title="Enable camera" onPress={requestPermission} /> : null}
          </View>
        )}

        {/* Reticle */}
        {canScan ? (
          <View pointerEvents="none" style={styles.reticleWrap}>
            <View style={styles.reticle} />
            <Text style={styles.hint}>Point at a barcode</Text>
          </View>
        ) : null}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
          <Text style={styles.title}>Scan to add{count > 0 ? " · " + count : ""}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.done}>
            <Text style={styles.doneTxt}>Done</Text>
          </Pressable>
        </View>

        {/* Status + manual/wedge entry */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          {last ? (
            <View style={[styles.status, { backgroundColor: last.ok ? "rgba(47,191,113,0.2)" : "rgba(229,72,77,0.2)" }]}>
              <Text style={[styles.statusTxt, { color: last.ok ? "#2FBF71" : "#E5484D" }]}>{last.text}</Text>
            </View>
          ) : null}
          <View style={styles.manualRow}>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="Enter or scan a barcode"
              placeholderTextColor={color.textFaint}
              style={styles.manualInput}
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                handle(manual);
                setManual("");
              }}
            />
            <Button
              title="Add"
              onPress={() => {
                handle(manual);
                setManual("");
              }}
              disabled={!manual.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  noCam: { alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl, backgroundColor: color.bg },
  noCamTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
  noCamBody: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.textDim, textAlign: "center" },
  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: space.md },
  reticle: { width: 260, height: 160, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)", borderRadius: radius.tile },
  hint: { color: "#fff", fontFamily: fontFamily.medium, fontSize: fontSize.caption, textShadowColor: "#000", textShadowRadius: 4 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  title: { color: "#fff", fontFamily: fontFamily.semibold, fontSize: fontSize.heading, textShadowColor: "#000", textShadowRadius: 4 },
  done: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  doneTxt: { color: "#fff", fontFamily: fontFamily.semibold, fontSize: fontSize.body },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: space.lg, gap: space.sm, backgroundColor: "rgba(0,0,0,0.55)" },
  status: { borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: "center" },
  statusTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.body },
  manualRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  manualInput: { flex: 1, backgroundColor: color.card2, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: fontFamily.regular, fontSize: fontSize.body },
});
