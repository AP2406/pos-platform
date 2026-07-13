import { Pressable, Text, StyleSheet, View, ActivityIndicator, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { color, gradient, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const dark = variant === "secondary" || variant === "ghost";
  const inner = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={dark ? color.text : "#FFFFFF"} />
      ) : (
        <Text style={[styles.label, dark ? { color: color.text } : null]}>{title}</Text>
      )}
    </View>
  );
  const press = disabled || loading ? undefined : onPress;
  const wrap: ViewStyle = { opacity: disabled ? 0.5 : 1, ...(style ?? {}) };

  if (variant === "primary") {
    // Primary CTA — the blue→cyan gradient (as the web "Charge" button), extended
    // to all primary actions per §4.
    return (
      <Pressable onPress={press} style={wrap} accessibilityRole="button">
        <LinearGradient colors={gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg = variant === "danger" ? color.late : variant === "secondary" ? color.card2 : "transparent";
  const border = variant === "ghost" ? { borderWidth: 1, borderColor: color.border } : null;
  return (
    <Pressable onPress={press} style={[styles.btn, { backgroundColor: bg }, border, wrap]} accessibilityRole="button">
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: touch.min,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: "#FFFFFF" },
});
