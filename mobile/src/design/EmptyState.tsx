import { Text, StyleSheet } from "react-native";
import { space } from "@surge/design-tokens";
import { text } from "./theme";

// Standard empty/placeholder copy — one dim, padded line. Keeps every list's
// "nothing here yet" state visually identical across screens.
export function EmptyState({ children }: { children: string }) {
  return <Text style={[text.bodyDim, styles.empty]}>{children}</Text>;
}

const styles = StyleSheet.create({
  empty: { padding: space.lg },
});
