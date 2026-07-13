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

// Floor map: a warm wood floor that fills the screen; tables are large, solid,
// saturated objects on top (TouchBistro-style). Status colors above stay
// saturated; vacant tables use a neutral slate so the white number/seat text reads.
export const floor = {
  // Warm light wood-plank floor.
  wood: "#E7DBC6",
  woodAlt: "#E1D4BC",
  seam: "rgba(90,60,25,0.13)",
  highlight: "rgba(255,255,255,0.30)",
  // Table text.
  onTable: "#FFFFFF",
  onTableDim: "rgba(255,255,255,0.85)",
  // Fixtures / walls.
  fixture: "#3A3A3A", // cash register / host stand
  wall: "#C9BBA2",
  // Default table fill when a table has no section.
  tableDefault: "#3E4657",
  // Status ring (thin, over the section-colored fill).
  ringVacant: "rgba(0,0,0,0.20)",
  ringOccupied: "#FFFFFF",
  ringWarning: "#F2B01E",
  ringLate: "#E5484D",
  ringPaid: "#2FA36B",
  // Bar stools.
  stoolOpen: "#2FA36B",
  stoolBusy: "#8E2C5B",
} as const;

// Bold, saturated fills assigned per SECTION (used when a section has no explicit
// color in the data). Distinct from the status ring colors.
export const sectionPalette = ["#2E2A5E", "#8E2C5B", "#2563EB", "#0E7C86", "#6D3A73", "#9A5A2B"] as const;

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
