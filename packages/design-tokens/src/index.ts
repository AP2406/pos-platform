// Surge design tokens — §4 of the Native iOS POS blueprint.
// Pure data (no React, no RN, no DOM) so both the Expo app and the web app can
// consume the exact same values. Numbers are unitless points (RN) / px (web).
//
// v2 (design review): higher-contrast dark scale, larger type, ONE solid primary
// (no gradients on normal buttons), and a single semantic status vocabulary that
// the floor, board, kitchen and orders all share.

export const color = {
  // THE TWO BLUES, AND WHY THERE ARE TWO.
  //
  // Surge-Logo-Kit-v1 specifies #008CFF. White on it measures 3.39:1 — under
  // AA for anything that isn't large text — and on this surface `blue` is a
  // FILL under white labels in roughly a dozen places: the primary Button, the
  // segmented tabs, the category rail, the seat tabs, the sign-in device
  // chips. So the identity blue and the working fill are split:
  //
  //   brand  #008CFF  the kit blue, untouched. Used where nothing sits on top
  //                   of it — the mark itself, hairlines, focus rings, tints.
  //                   5.16:1 against `card`, so it is legible as a tint too.
  //   blue   #006BDD  the same hue and chroma in OKLCH — oklch(0.54 0.2 253)
  //                   against the kit's oklch(0.64 0.2 253) — walked down in
  //                   lightness until white passes. 5.06:1, versus the 5.17:1
  //                   that #2563EB gave, so no control gets harder to read.
  //                   This is byte-identical to the web's light-theme
  //                   --primary, which is the point: one product, one fill.
  brand: "#008CFF",
  blue: "#006BDD",
  blueHover: "#0057B8",
  // Retired as a brand colour. The kit has no cyan — the old mark's speed
  // lines were #06B6D4 and the new one's are the blue itself — but the value
  // stays because `gradient.primary` is still exported for the web, and a
  // token nobody can see is cheaper than a broken import.
  cyan: "#06B6D4",

  // Dark surfaces: page → raised → cards/inputs.
  bg: "#0B0D12",
  card: "#151927",
  card2: "#1C2132",
  border: "#2B3348",
  borderStrong: "#3A4460",

  // Text.
  text: "#F8FAFC",
  textDim: "#A7B0C2",
  textFaint: "#718096",
  onPrimary: "#FFFFFF",

  // Status semantics — the same four meanings everywhere.
  available: "#5B6472", // neutral / empty
  occupied: "#006BDD", // seated / active — tracks `blue`, white seat text on it
  success: "#14B86E", // confirmed / ready / paid
  warning: "#F59E0B", // attention / payment due
  late: "#EF4444", // error / late
  // Tinted fills for chips/badges (12–18% of the status color on dark).
  successSoft: "rgba(20,184,110,0.16)",
  warningSoft: "rgba(245,158,11,0.16)",
  lateSoft: "rgba(239,68,68,0.16)",
  // A tint, never a text background — so this one takes the KIT blue rather
  // than the fill: a wash of #008CFF at 18% is the brand showing through, and
  // at 18% the lightness difference between the two blues is invisible anyway.
  blueSoft: "rgba(0,140,255,0.18)",
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
  onTableDim: "rgba(255,255,255,0.88)",
  // Fixtures / walls.
  fixture: "#3A3A3A", // cash register / host stand
  wall: "#C9BBA2",
  // Legacy status fills (kept for the web floor renderer).
  statusAvailable: "#4B5563",
  statusOccupied: "#006BDD",
  statusWarning: "#F59E0B",
  statusLate: "#EF4444",
  statusPaid: "#14B86E",
  // Subtle edge ring for object definition.
  ring: "rgba(0,0,0,0.22)",
  // Bar stools.
  stoolOpen: "#14B86E",
  stoolBusy: "#006BDD",
} as const;

// Bold, saturated fills assigned per SECTION (used when a section has no explicit
// color in the data). Distinct from the status ring colors.
export const sectionPalette = ["#2E2A5E", "#8E2C5B", "#006BDD", "#0E7C86", "#6D3A73", "#9A5A2B"] as const;

// Brand gradient — reserved for brand surfaces. Normal buttons are SOLID
// `color.blue` (design review §2). Kept so the web can import it.
//
// Re-aimed at the kit: the ramp used to run blue -> cyan, which was the old
// mark's two colours. The new mark has ONE colour and fades it toward white at
// the tips, so the gradient does the same — kit blue into its own darker rung,
// no second hue invented for it.
export const gradient = {
  primary: [color.brand, color.blueHover] as [string, string],
} as const;

// Fixed type scale (Poppins). SemiBold 600 for numbers/headings, Regular/Medium
// body. Bumped one step across the board for an iPad held at arm's length; no
// merchant-facing text below `micro` (12), and captions are 14.
export const fontSize = {
  display: 34,
  title: 26,
  heading: 20,
  body: 16,
  caption: 14,
  micro: 12,
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

// 8-pt spacing grid (xs is the half-step for tight chip gaps).
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Radius: controls (buttons/inputs/chips) 8, cards 12, tiles 14, pills 999.
export const radius = {
  control: 8,
  card: 12,
  tile: 14,
  pill: 999,
} as const;

// Minimum touch target (accessibility + fast-paced floor use).
export const touch = {
  min: 48,
  cta: 56,
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

// ── Floor v2: service lifecycle ────────────────────────────────────────────
// The PRIMARY signal on every table tile and board card (text + color, never
// color alone), derived from the open ticket + its kitchen tickets. ONE
// vocabulary — the legend, the map, the board and the check header all read
// these labels and colors from here, so they can never drift apart.
//
//   available   no open check — seat it            neutral slate
//   open        seated, order being built           violet
//   sent        fired, cooking                      primary blue
//   ready       every kitchen ticket bumped         green (confirmed/ready)
//   pay         check presented, payment due        amber (attention)
//
// Time-based escalation is the SECONDARY signal (see `aging` below): red is
// reserved for "Late" so it never collides with a stage color.
export type ServiceStage = "available" | "open" | "sent" | "ready" | "pay";

export const stage = {
  available: "#4B5563",
  open: "#7C3AED",
  sent: "#006BDD",
  ready: "#14B86E",
  pay: "#F59E0B",
} as const;

export const STAGE_LABEL: Record<ServiceStage, string> = {
  available: "Available",
  open: "Open",
  sent: "Sent",
  ready: "Ready",
  pay: "Payment due",
};

// Short label for tight spaces (compact table tiles).
export const STAGE_LABEL_SHORT: Record<ServiceStage, string> = {
  available: "Available",
  open: "Open",
  sent: "Sent",
  ready: "Ready",
  pay: "Pay",
};

export const STAGE_ORDER: ServiceStage[] = ["available", "open", "sent", "ready", "pay"];

export function serviceStageColor(s: ServiceStage): string {
  return stage[s];
}

// Secondary, time-based escalation shown as a small labeled badge on top of the
// stage color. `warning` tints the elapsed time amber; `late` adds a red badge.
export type AgingTier = "normal" | "warning" | "late";
export const aging = {
  warning: "#F59E0B",
  late: "#EF4444",
} as const;

export const AGING_LABEL: Record<Exclude<AgingTier, "normal">, string> = {
  warning: "Running long",
  late: "Late",
};

export function agingTier(minutes: number | null, yellowMin: number, redMin: number): AgingTier {
  if (minutes == null) return "normal";
  if (minutes >= redMin) return "late";
  if (minutes >= yellowMin) return "warning";
  return "normal";
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
