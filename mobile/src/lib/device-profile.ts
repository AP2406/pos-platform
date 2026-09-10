import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DeviceStation } from "./access";

// THIS physical device's profile — persisted locally (AsyncStorage), because a
// device label, its assigned station, and its printer target are per-device, not a
// shared business setting. Extends the legacy `surge_device_home` (pos/kds) key.
// Money-independent: pure device configuration.
export type DeviceProfile = {
  label: string; // friendly device name (e.g. "Bar iPad")
  station: DeviceStation | null; // drives role-based screen access; null = role-based
  defaultPlanId: string | null; // Floor opens to this room by default
  printerTarget: string | null; // receipt/kitchen printer id (see PRINTER_TARGETS)
  demoMode?: boolean; // dev-only: show the demo restaurant instead of live data
  lockAfterMin?: number; // idle minutes before the iPad returns to the PIN pad (0 = never)
};

// Auto-lock choices offered in Device settings. Kitchen-station iPads never lock.
export const LOCK_OPTIONS: { key: number; label: string }[] = [
  { key: 0, label: "Never" },
  { key: 2, label: "2 min" },
  { key: 5, label: "5 min" },
  { key: 10, label: "10 min" },
  { key: 30, label: "30 min" },
];
export const DEFAULT_LOCK_MIN = 10;
// Coming back from the background after this long also locks (when locking is on).
export const BACKGROUND_LOCK_MIN = 2;

export const DEFAULT_DEVICE_PROFILE: DeviceProfile = { label: "", station: null, defaultPlanId: null, printerTarget: null, demoMode: false, lockAfterMin: DEFAULT_LOCK_MIN };

// Receipt/kitchen printer targets this device can be pointed at. The connection
// itself is reported live by lib/printing (printerStatus).
export const PRINTER_TARGETS: { id: string; label: string }[] = [
  { id: "none", label: "No printer" },
  { id: "front_star", label: "Front counter — Star TSP" },
  { id: "kitchen_epson", label: "Kitchen — Epson TM" },
  { id: "bar_star", label: "Bar — Star mC-Print" },
];

const KEY = "surge_device_profile";
const LEGACY_HOME_KEY = "surge_device_home";

export async function loadDeviceProfile(): Promise<DeviceProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_DEVICE_PROFILE, ...(JSON.parse(raw) as Partial<DeviceProfile>) };
    // Migrate the legacy pos/kds device-home flag → a Kitchen station.
    const legacy = await AsyncStorage.getItem(LEGACY_HOME_KEY);
    if (legacy === "kds") return { ...DEFAULT_DEVICE_PROFILE, station: "kitchen" };
  } catch {
    /* fall through to default */
  }
  return DEFAULT_DEVICE_PROFILE;
}

export async function saveDeviceProfile(p: DeviceProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
    // Keep the legacy key in sync so anything still reading it stays correct.
    if (p.station === "kitchen") await AsyncStorage.setItem(LEGACY_HOME_KEY, "kds");
    else await AsyncStorage.removeItem(LEGACY_HOME_KEY);
  } catch {
    /* best-effort persistence */
  }
}

export function printerLabel(id: string | null): string {
  return PRINTER_TARGETS.find((t) => t.id === id)?.label ?? "No printer";
}
