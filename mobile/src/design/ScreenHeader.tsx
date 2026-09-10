import type { ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ChevronLeft, LogOut } from "lucide-react-native";
import { color, space, fontFamily, fontSize, radius, touch } from "@surge/design-tokens";

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
          <Pressable onPress={onBack} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={"Back to " + backLabel}>
            <ChevronLeft size={20} color={color.text} strokeWidth={2.25} />
            <Text style={styles.backTxt}>{backLabel}</Text>
          </Pressable>
        ) : onSignOut ? (
          <Pressable onPress={onSignOut} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Sign out">
            <LogOut size={18} color={color.textDim} strokeWidth={2} />
            <Text style={[styles.backTxt, { color: color.textDim }]}>Sign out</Text>
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.spacer} />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touch.min },
  back: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: touch.min, paddingRight: space.sm, paddingLeft: 2, borderRadius: radius.control },
  backTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  titles: { flexDirection: "row", alignItems: "baseline", gap: space.sm, flexShrink: 1 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim, flexShrink: 1 },
  spacer: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
