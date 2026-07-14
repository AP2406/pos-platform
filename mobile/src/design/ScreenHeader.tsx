import type { ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { color, space, fontFamily } from "@surge/design-tokens";
import { text } from "./theme";

// The one native screen header. A back affordance (‹ Floor) or a Sign-out
// fallback on the left, the title (+ optional subtitle), and optional right-side
// actions; `children` render a row beneath (tabs/filters). Every non-Floor screen
// uses this so nav, spacing, and type are identical everywhere.
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Floor",
  onSignOut,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  onSignOut?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={text.bodyDim}>‹ {backLabel}</Text>
          </Pressable>
        ) : onSignOut ? (
          <Pressable onPress={onSignOut} hitSlop={12}>
            <Text style={text.bodyDim}>Sign out</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={text.caption}>{subtitle}</Text> : null}
        <View style={styles.spacer} />
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  title: { fontFamily: fontFamily.semibold, fontSize: 20, color: color.text },
  spacer: { flex: 1 },
});
