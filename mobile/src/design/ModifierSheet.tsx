import { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import {
  activeGroups,
  buildLine,
  countInGroup,
  groupMin,
  groupOf,
  requiredUnmet,
  toggleMod,
  type ModifierGroup,
  type ModPosition,
  type Variation,
  type LineModifier,
} from "../lib/modifiers";

// The item shape the sheet needs (a subset of MenuItem).
export type SheetItem = { id: string; name: string; price: number; variations: Variation[]; modifierGroups: ModifierGroup[] };

export type SheetInitial = { variationId: string | null; selected: string[]; positions: Record<string, ModPosition>; note: string };

export type ConfirmSpec = { catalogItemId: string; variationId: string | null; name: string; unitPrice: number; note: string | null; modifiers: LineModifier[] };

const money = (n: number) => "$" + (n || 0).toFixed(2);

// Forced/nested modifier picker. Enforces per-group min/max, half/left-right
// placement, and follow-up (child) groups; the confirm button is gated until
// every active required group is satisfied. Money-independent (shapes the line).
export function ModifierSheet({
  item,
  initial,
  isEdit,
  onClose,
  onConfirm,
}: {
  item: SheetItem | null;
  initial?: SheetInitial;
  isEdit?: boolean;
  onClose: () => void;
  onConfirm: (spec: ConfirmSpec) => void;
}) {
  const [variationId, setVariationId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, ModPosition>>({});
  const [note, setNote] = useState("");
  // Re-seed state when the sheet opens for a (different) item.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = item ? item.id + (isEdit ? ":edit" : "") : null;
  if (item && key !== seededFor) {
    setVariationId(initial?.variationId ?? (item.variations[0]?.id ?? null));
    setSelected(initial?.selected ?? []);
    setPositions(initial?.positions ?? {});
    setNote(initial?.note ?? "");
    setSeededFor(key);
  }

  const groups = item?.modifierGroups ?? [];
  const unmet = useMemo(() => (item ? requiredUnmet(groups, selected) : []), [item, groups, selected]);
  const built = useMemo(() => (item ? buildLine(item, variationId, selected, positions) : null), [item, variationId, selected, positions]);
  const varUnmet = !!item && item.variations.length > 0 && !variationId;
  const blocked = varUnmet || unmet.length > 0;

  function renderGroup(g: ModifierGroup, depth: number) {
    const single = g.max_select === 1;
    const min = groupMin(g);
    const count = countInGroup(g, selected);
    const groupUnmet = min > 0 && count < min;
    const atMax = g.max_select != null && count >= g.max_select;
    const hint = single
      ? "Choose 1"
      : g.max_select != null
      ? min > 0
        ? "Choose " + min + "–" + g.max_select
        : "Choose up to " + g.max_select
      : min > 0
      ? "Choose at least " + min
      : "Optional";
    return (
      <View key={g.id} style={[styles.group, depth > 0 && styles.nested]}>
        <View style={styles.groupHead}>
          <Text style={styles.groupName}>{g.name}</Text>
          <Text style={[styles.hint, groupUnmet && styles.hintUnmet]}>{(g.required ? "Required · " : "") + hint}</Text>
        </View>
        {g.options.map((m) => {
          const checked = selected.includes(m.id);
          const disabled = !checked && atMax && !single;
          const activePos = positions[m.id] ?? "whole";
          return (
            <View key={m.id}>
              <Pressable
                onPress={() => !disabled && setSelected((prev) => toggleMod(groups, prev, m.id))}
                style={[styles.opt, checked && styles.optOn, disabled && styles.optDisabled]}
              >
                <View style={styles.optLeft}>
                  <View style={[styles.box, single && styles.radio, checked && styles.boxOn]}>{checked ? <Text style={styles.check}>✓</Text> : null}</View>
                  <Text style={styles.optName}>{m.name}</Text>
                </View>
                {m.price > 0 ? <Text style={styles.optPrice}>+{money(m.price)}</Text> : null}
              </Pressable>
              {checked && g.allow_split && (
                <View style={styles.splitRow}>
                  {(["whole", "left", "right"] as const).map((p) => (
                    <Pressable key={p} onPress={() => setPositions((prev) => ({ ...prev, [m.id]: p }))} style={[styles.splitBtn, activePos === p && styles.splitOn]}>
                      <Text style={[styles.splitTxt, activePos === p && styles.splitTxtOn]}>{p === "whole" ? "Whole" : p === "left" ? "½ Left" : "½ Right"}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {checked && m.child_group ? renderGroup(m.child_group, depth + 1) : null}
            </View>
          );
        })}
      </View>
    );
  }

  function confirm() {
    if (!item || !built || blocked) return;
    onConfirm({ catalogItemId: item.id, variationId: built.variationId, name: built.name, unitPrice: built.unitPrice, note: note.trim() || null, modifiers: built.modifiers });
  }

  const cta = blocked
    ? varUnmet
      ? "Choose a size"
      : "Choose " + unmet[0].name
    : (isEdit ? "Save · " : "Add · ") + money(built?.unitPrice ?? 0);

  return (
    <BottomSheet visible={!!item} onClose={onClose} title={item?.name}>
      {item ? (
        <>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {item.variations.length > 0 && (
              <View style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupName}>Size</Text>
                  <Text style={[styles.hint, varUnmet && styles.hintUnmet]}>Required · Choose 1</Text>
                </View>
                {item.variations.map((v) => {
                  const on = variationId === v.id;
                  return (
                    <Pressable key={v.id} onPress={() => setVariationId(v.id)} style={[styles.opt, on && styles.optOn]}>
                      <View style={styles.optLeft}>
                        <View style={[styles.box, styles.radio, on && styles.boxOn]}>{on ? <Text style={styles.check}>✓</Text> : null}</View>
                        <Text style={styles.optName}>{v.name}</Text>
                      </View>
                      <Text style={styles.optPrice}>{money(v.price)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {groups.map((g) => renderGroup(g, 0))}
            <TextInput value={note} onChangeText={setNote} placeholder="Note for the kitchen (optional)" placeholderTextColor={color.textFaint} style={styles.note} />
          </ScrollView>
          <Button title={cta} onPress={confirm} disabled={blocked} />
        </>
      ) : null}
    </BottomSheet>
  );
}

// Groups currently active (for prefilling / summaries) — re-exported for callers.
export { activeGroups, groupOf };

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  group: { marginBottom: space.md },
  nested: { marginLeft: space.sm, paddingLeft: space.md, borderLeftWidth: 1, borderLeftColor: color.border },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
  groupName: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  hintUnmet: { color: color.late },
  opt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2, marginBottom: space.xs },
  optOn: { borderColor: color.blue, backgroundColor: color.card },
  optDisabled: { opacity: 0.4 },
  optLeft: { flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: color.textDim, alignItems: "center", justifyContent: "center" },
  radio: { borderRadius: 999 },
  boxOn: { backgroundColor: color.blue, borderColor: color.blue },
  check: { color: "#fff", fontSize: 12, fontFamily: fontFamily.semibold },
  optName: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text, flexShrink: 1 },
  optPrice: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  splitRow: { flexDirection: "row", gap: space.xs, paddingLeft: space.xl, marginBottom: space.xs },
  splitBtn: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border },
  splitOn: { borderColor: color.blue, backgroundColor: color.card },
  splitTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  splitTxtOn: { color: color.text },
  note: { backgroundColor: color.card2, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: fontFamily.regular, fontSize: fontSize.body, marginTop: space.xs },
});
