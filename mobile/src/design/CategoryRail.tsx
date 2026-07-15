import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

export type RailCategory = { key: string; label: string; count: number; icon: string };

// Left-edge category rail (thumb-zone): one tappable cell per category with its
// distinct icon, label, and live item count. Vertical + scrollable so long menus
// stay reachable. Presentation only — money-independent.
export function CategoryRail({ categories, value, onChange }: { categories: RailCategory[]; value: string; onChange: (key: string) => void }) {
  return (
    <ScrollView style={styles.rail} contentContainerStyle={styles.railInner} showsVerticalScrollIndicator={false}>
      {categories.map((c) => {
        const on = c.key === value;
        return (
          <Pressable key={c.key} onPress={() => onChange(c.key)} style={[styles.cell, on && styles.cellOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={styles.icon}>{c.icon}</Text>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>
              {c.label}
            </Text>
            <View style={[styles.count, on && styles.countOn]}>
              <Text style={[styles.countTxt, on && styles.countTxtOn]}>{c.count}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { width: 84, flexGrow: 0 },
  railInner: { gap: space.xs, paddingRight: space.xs, paddingBottom: space.lg },
  cell: { alignItems: "center", gap: 2, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.card, borderWidth: 1, borderColor: "transparent" },
  cellOn: { backgroundColor: color.card2, borderColor: color.blue },
  icon: { fontSize: 24 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim, textAlign: "center" },
  labelOn: { color: color.text },
  count: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: color.card },
  countOn: { backgroundColor: color.blue },
  countTxt: { fontFamily: fontFamily.semibold, fontSize: 10, color: color.textDim, textAlign: "center" },
  countTxtOn: { color: "#fff" },
});
