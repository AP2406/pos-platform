import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";
import { Button } from "./Button";

// Intentional empty state: an optional icon, a short title, ONE sentence that
// says what will appear here, and at most ONE action. Passing a bare string
// (`<EmptyState>No sales.</EmptyState>`) still works and renders as the title.
export function EmptyState({
  children,
  title,
  body,
  icon,
  actionLabel,
  onAction,
  compact,
}: {
  children?: string;
  title?: string;
  body?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const heading = title ?? children ?? "";
  if (compact || (!body && !icon && !actionLabel)) {
    return (
      <View style={styles.compact}>
        <Text style={styles.compactTxt}>{heading}</Text>
        {body ? <Text style={styles.compactBody}>{body}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{heading}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { padding: space.lg, gap: space.xs },
  compactTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.textDim },
  compactBody: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textFaint },
  wrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm },
  icon: { width: 56, height: 56, borderRadius: radius.card, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text, textAlign: "center" },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: color.textDim, textAlign: "center", maxWidth: 420 },
  action: { marginTop: space.sm },
});
