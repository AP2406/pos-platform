import { Pressable, Text, StyleSheet, ScrollView } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, active && styles.active]}>
            <Text style={[styles.txt, active && styles.txtActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs },
  tab: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.card },
  active: { backgroundColor: color.card2, borderWidth: 1, borderColor: color.blue },
  txt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  txtActive: { color: color.text },
});
