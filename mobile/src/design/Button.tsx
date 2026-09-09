import type { ReactNode } from "react";
import { Pressable, Text, StyleSheet, View, ActivityIndicator, type ViewStyle } from "react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "md" | "lg";

// The one button. Solid fills only (no gradients on working controls), ≥48pt
// tall, 8pt radius. `lg` is the 56pt register CTA. A disabled button keeps its
// label legible (dimmed, not ghosted) so "why can't I tap this" is answerable.
export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const filled = variant === "primary" || variant === "danger" || variant === "success";
  const labelColor = filled ? color.onPrimary : color.text;
  const bg = variant === "primary" ? color.blue : variant === "danger" ? color.late : variant === "success" ? color.success : variant === "secondary" ? color.card2 : "transparent";
  const border = variant === "ghost" || variant === "secondary" ? { borderWidth: 1, borderColor: variant === "ghost" ? color.borderStrong : color.border } : null;
  const press = disabled || loading ? undefined : onPress;

  return (
    <Pressable
      onPress={press}
      style={({ pressed }) => [styles.btn, size === "lg" && styles.lg, { backgroundColor: bg }, border, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={[styles.label, size === "lg" && styles.labelLg, { color: labelColor }]} numberOfLines={1}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: touch.min,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  lg: { minHeight: touch.cta, paddingHorizontal: space.xl },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  inner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  icon: { alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.body },
  labelLg: { fontSize: 17 },
});
