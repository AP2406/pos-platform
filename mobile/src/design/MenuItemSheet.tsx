import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { groupMin, type ModifierGroup, type Variation } from "../lib/modifiers";
import { allergenLabels } from "../lib/allergens";

// Read-only catalog detail: price, section, allergen tags, and a preview of the
// item's variations + forced-modifier groups (same tree the picker enforces).
// "Add to order" hands back to the Register's existing add flow — no money logic.
export type DetailItem = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  salesCategory: string | null;
  imageUrl: string | null;
  outOfStock: boolean;
  allergens: string[];
  variations: Variation[];
  modifierGroups: ModifierGroup[];
};

const money = (n: number) => "$" + (n || 0).toFixed(2);

function groupHint(g: ModifierGroup): string {
  const min = groupMin(g);
  if (g.max_select === 1) return "Choose 1";
  if (g.max_select != null) return min > 0 ? "Choose " + min + "–" + g.max_select : "Choose up to " + g.max_select;
  return min > 0 ? "Choose at least " + min : "Optional";
}

export function MenuItemSheet({ item, onClose, onAdd }: { item: DetailItem | null; onClose: () => void; onAdd: (item: DetailItem) => void }) {
  const allergyTags = item ? allergenLabels(item.allergens) : [];
  return (
    <BottomSheet visible={!!item} onClose={onClose} title={item?.name}>
      {item ? (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.hero} resizeMode="cover" /> : null}

            <View style={styles.priceRow}>
              <Text style={styles.price}>{money(item.price)}</Text>
              {item.salesCategory || item.category ? <Text style={styles.section}>{item.salesCategory || item.category}</Text> : null}
              {item.outOfStock ? <Text style={styles.oos}>Sold out</Text> : null}
            </View>

            {allergyTags.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>Allergens</Text>
                <View style={styles.chips}>
                  {allergyTags.map((a) => (
                    <View key={a} style={styles.allergyChip}>
                      <Text style={styles.allergyTxt}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {item.variations.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>Sizes</Text>
                <View style={styles.chips}>
                  {item.variations.map((v) => (
                    <View key={v.id} style={styles.optChip}>
                      <Text style={styles.optName}>{v.name}</Text>
                      <Text style={styles.optPrice}>{money(v.price)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {item.modifierGroups.map((g) => (
              <View key={g.id} style={styles.block}>
                <View style={styles.groupHead}>
                  <Text style={styles.blockLabel}>{g.name}</Text>
                  <Text style={[styles.hint, g.required && styles.hintReq]}>{(g.required ? "Required · " : "") + groupHint(g)}</Text>
                </View>
                <View style={styles.chips}>
                  {g.options.map((o) => (
                    <View key={o.id} style={styles.optChip}>
                      <Text style={styles.optName}>
                        {o.name}
                        {o.child_group ? " (more options)" : ""}
                      </Text>
                      {o.price > 0 ? <Text style={styles.optPrice}>+{money(o.price)}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <Button title={item.outOfStock ? "Sold out today" : "Add to check"} size="lg" disabled={item.outOfStock} onPress={() => onAdd(item)} />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 440 },
  hero: { width: "100%", height: 160, borderRadius: radius.card, marginBottom: space.md, backgroundColor: color.card2 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  price: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
  section: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim, backgroundColor: color.card2, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: "hidden" },
  oos: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: "#fff", backgroundColor: color.late, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: "hidden" },
  block: { marginBottom: space.md, gap: space.xs },
  blockLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  hintReq: { color: color.blue },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  allergyChip: { backgroundColor: color.late, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  allergyTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: "#fff" },
  optChip: { flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 },
  optName: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.text },
  optPrice: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
});
