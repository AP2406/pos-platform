import { Pressable, Text, StyleSheet, ScrollView, View } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

// Horizontal filter/segment control. The wrapper is `flexGrow: 0` on purpose: a
// bare horizontal ScrollView inside a column stretches to fill the column (it
// was rendering as a tall pill in the register). Active segment is a solid
// primary fill with white text so the selection is unmistakable.
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  counts,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
        {tabs.map((t) => {
          const active = t.key === value;
          const n = counts?.[t.key];
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, active && styles.active]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={[styles.txt, active && styles.txtActive]}>{t.label}</Text>
              {n != null && n > 0 ? (
                <View style={[styles.count, active && styles.countActive]}>
                  <Text style={[styles.countTxt, active && styles.countTxtActive]}>{n}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 0, flexShrink: 0 },
  scroll: { flexGrow: 0 },
  row: { gap: space.sm, paddingVertical: 2 },
  tab: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border },
  active: { backgroundColor: color.blue, borderColor: color.blue },
  txt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  txtActive: { color: color.onPrimary, fontFamily: fontFamily.semibold },
  count: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: color.card },
  countActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  countTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: color.textDim, textAlign: "center" },
  countTxtActive: { color: color.onPrimary },
});
