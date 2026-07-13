// Surge design tokens — §4 of the Native iOS POS blueprint.
// Pure data (no React, no RN, no DOM) so both the Expo app and the web app can
// consume the exact same values. Numbers are unitless points (RN) / px (web).

export const color = {
  // Brand — primary CTAs use the blue→cyan gradient (see `gradient.primary`).
  blue: "#2563EB",
  cyan: "#06B6D4",

  // Dark surfaces.
  bg: "#0B0E14",
  card: "#131722",
  card2: "#1A1F2E",
  border: "#232838",

  // Text.
  text: "#FFFFFF",
  textDim: "#8A93A6",
  textFaint: "#5B6472",

  // Status semantics — escalate table color by wait time (the audit's biggest miss).
  available: "#5B6472", // neutral / empty
  occupied: "#2563EB", // seated / active
  warning: "#F5A623", // approaching over-time
  late: "#E5484D", // over 90m
  success: "#2FBF71", // paid / confirmed
} as const;

// Floor map: a lit, lighter surface so tables/chairs read as physical objects
// (TouchBistro-style), even though the rest of the app stays dark.
export const floor = {
  surface: "#D9DDE4", // light neutral room panel
  surfaceBorder: "#C2C7D1",
  table: "#242B39", // solid slate table object
  chair: "#6B7280", // mid-tone chair, visible on the light floor
  onTable: "#FFFFFF", // table number/name
  onTableDim: "#C7CCD6", // muted $ / time chips
  fixture: "#3A4152", // bar / host stand
  wall: "#9AA1AE",
} as const;

// Primary gradient (blue → cyan) — the "Charge" button, extended to all primary CTAs.
export const gradient = {
  primary: [color.blue, color.cyan] as [string, string],
} as const;

// Fixed type scale (Poppins). SemiBold 600 for numbers/headings, Regular/Medium body.
export const fontSize = {
  display: 32,
  title: 24,
  heading: 18,
  body: 15,
  caption: 13,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
} as const;

export const fontFamily = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
} as const;

// 4-pt spacing base.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Radius: cards 12, tiles 16, pills 999.
export const radius = {
  card: 12,
  tile: 16,
  pill: 999,
} as const;

// Minimum touch target (accessibility + fast-paced floor use).
export const touch = {
  min: 48,
} as const;

// Status → color helper, with wait-time escalation for tables.
export type TableStatus = "available" | "occupied" | "warning" | "late" | "paid";

export function tableStatusColor(status: TableStatus): string {
  switch (status) {
    case "occupied":
      return color.occupied;
    case "warning":
      return color.warning;
    case "late":
      return color.late;
    case "paid":
      return color.success;
    case "available":
    default:
      return color.available;
  }
}

// Escalate an occupied table's status by how long it's been seated (minutes).
// Neutral until seated; warning at 60m; late at 90m. `paid` is set explicitly.
export function statusFromSeatedMinutes(minutes: number | null): TableStatus {
  if (minutes == null) return "available";
  if (minutes >= 90) return "late";
  if (minutes >= 60) return "warning";
  return "occupied";
}

export const tokens = {
  color,
  gradient,
  fontSize,
  fontWeight,
  fontFamily,
  space,
  radius,
  touch,
} as const;

export default tokens;
