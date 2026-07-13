import { StyleSheet } from "react-native";
import { color, fontSize, fontFamily } from "@surge/design-tokens";

// Shared text styles built from the design tokens. Re-export tokens so screens
// import everything design-related from one place (`@/design`).
export { color, floor, gradient, fontSize, fontFamily, space, radius, touch, tableStatusColor, statusFromSeatedMinutes } from "@surge/design-tokens";
export type { TableStatus } from "@surge/design-tokens";

export const text = StyleSheet.create({
  display: { fontFamily: fontFamily.semibold, fontSize: fontSize.display, color: color.text },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
  heading: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.text },
  bodyDim: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.textDim },
  caption: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
});
