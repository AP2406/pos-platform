import { Text, StyleSheet, Pressable, ScrollView } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

type IconComponent = LucideIcon;
export type RailCategory = { key: string; label: string; count: number; Icon: IconComponent };

// Left-edge category rail (thumb-zone): one tappable cell per category with its
// Lucide glyph, label, and live item count. Vertical + scrollable so long menus
// stay reachable. The selected cell is a solid primary fill. Presentation only.
export function CategoryRail({ categories, value, onChange }: { categories: RailCategory[]; value: string; onChange: (key: string) => void }) {
  return (
    <ScrollView style={styles.rail} contentContainerStyle={styles.railInner} showsVerticalScrollIndicator={false}>
      {categories.map((c) => {
        const on = c.key === value;
        const Icon = c.Icon;
        return (
          <Pressable key={c.key} onPress={() => onChange(c.key)} style={[styles.cell, on && styles.cellOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={c.label + ", " + c.count + " items"}>
            <Icon size={22} color={on ? color.onPrimary : color.textDim} strokeWidth={2} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>
              {c.label}
            </Text>
            <Text style={[styles.count, on && styles.countOn]}>{c.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { width: 92, flexGrow: 0 },
  railInner: { gap: space.xs, paddingRight: space.xs, paddingBottom: space.lg },
  cell: { minHeight: 76, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.card, backgroundColor: color.card, borderWidth: 1, borderColor: color.border },
  cellOn: { backgroundColor: color.blue, borderColor: color.blue },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.micro + 1, lineHeight: 15, color: color.text, textAlign: "center" },
  labelOn: { color: color.onPrimary, fontFamily: fontFamily.semibold },
  count: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: color.textFaint },
  countOn: { color: "rgba(255,255,255,0.8)" },
});
