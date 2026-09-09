import { StyleSheet } from "react-native";
import { color, fontSize, fontFamily } from "@surge/design-tokens";

// Shared text styles built from the design tokens. Re-export tokens so screens
// import everything design-related from one place (`@/design`).
export {
  color,
  floor,
  sectionPalette,
  gradient,
  fontSize,
  fontFamily,
  space,
  radius,
  touch,
  tableStatusColor,
  statusFromSeatedMinutes,
  serviceStageColor,
  agingTier,
  STAGE_LABEL,
  STAGE_LABEL_SHORT,
  STAGE_ORDER,
  AGING_LABEL,
  stage as stageColors,
  aging,
} from "@surge/design-tokens";
export type { TableStatus, ServiceStage, AgingTier } from "@surge/design-tokens";

export const text = StyleSheet.create({
  display: { fontFamily: fontFamily.semibold, fontSize: fontSize.display, color: color.text },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
  heading: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.text },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  bodyDim: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.textDim },
  caption: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  captionStrong: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: color.text },
  micro: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: color.textDim },
  // Section label above a group of cards/rows ("ON THE CLOCK", "TOP ITEMS").
  eyebrow: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: color.textDim, letterSpacing: 1.2, textTransform: "uppercase" },
});
