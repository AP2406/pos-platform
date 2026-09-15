import { View, Pressable, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

// A key is a digit, ".", "back", or "confirm". Consumers decide what the value
// means (price, PIN, quantity). Keeps money/PIN logic out of the component.
export type NumKey = string;

// Cells carry their own half-gutter as PADDING and the row cancels it with a
// negative margin, instead of `gap`. That is what makes a 2-wide cell measure
// exactly two columns PLUS the gutter: flex splits the row including each
// cell's padding, so a flex:2 cell lands on 2k + gutter, where a `gap` layout
// would land ~3pt short and leave a visible seam offset against the rows above.
const HALF_GUTTER = space.xs; // → space.sm (8) between keys

type PadSize = "md" | "lg";
type Cell = { k: NumKey; flex: number };

// `confirm` puts submit ON the pad, which is what TouchBistro does (its bottom
// row is ⌫ 0 ✓) and what Square achieves by auto-submitting the Nth digit. The
// thumb is already inside the 3×4 grid; making it leave the grid to reach a
// separate button below is a second reach per sign-in, all day.
export type NumPadConfirm = { label: string; busy?: boolean };

export function NumPad({
  onKey,
  decimal = true,
  size = "md",
  confirm,
}: {
  onKey: (key: NumKey) => void;
  decimal?: boolean;
  size?: PadSize;
  confirm?: NumPadConfirm | null;
}) {
  const keyHeight = size === "lg" ? touch.key : touch.min + 8;
  // The bottom row is the only row that varies, and none of the three variants
  // contains a hole:
  //   money   → .  0  ⌫
  //   PIN     → ⌫  0  ✓     (confirm supplied)
  //   plain   → [  0  ] ⌫   (no confirm: 0 spans the freed column)
  // What it must never be again is a disabled-but-present cell, which is what
  // `decimal={false}` used to render: VoiceOver announces that as "Button, Not
  // Enabled" — a control that does nothing, announcing itself to the person
  // least able to skip past it. Neither TouchBistro nor Square ships an empty
  // cell here.
  const bottom: Cell[] = decimal
    ? [{ k: ".", flex: 1 }, { k: "0", flex: 1 }, { k: "back", flex: 1 }]
    : confirm
      ? [{ k: "back", flex: 1 }, { k: "0", flex: 1 }, { k: "confirm", flex: 1 }]
      : [{ k: "0", flex: 2 }, { k: "back", flex: 1 }];
  const rows: Cell[][] = [
    [{ k: "1", flex: 1 }, { k: "2", flex: 1 }, { k: "3", flex: 1 }],
    [{ k: "4", flex: 1 }, { k: "5", flex: 1 }, { k: "6", flex: 1 }],
    [{ k: "7", flex: 1 }, { k: "8", flex: 1 }, { k: "9", flex: 1 }],
    bottom,
  ];

  // Every key gets a spoken name. A digit reads as itself; the two glyph keys
  // do not, and "⌫" is the one key that destroys what you just typed.
  const labelFor = (k: NumKey) =>
    k === "back" ? "Delete" : k === "." ? "Decimal point" : k === "confirm" ? (confirm?.label ?? "Confirm") : k;

  return (
    <View style={styles.pad}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(({ k, flex }) => {
            const isConfirm = k === "confirm";
            const busy = isConfirm && confirm?.busy === true;
            return (
              <View key={k} style={[styles.cell, { flex }]}>
                <Pressable
                  onPress={() => !busy && onKey(k)}
                  style={({ pressed }) => [
                    styles.key,
                    { minHeight: keyHeight },
                    isConfirm && styles.keyConfirm,
                    pressed && styles.keyPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ busy }}
                  accessibilityLabel={labelFor(k)}
                >
                  {busy ? (
                    <ActivityIndicator color={color.onPrimary} />
                  ) : isConfirm ? (
                    // Rounded style is kept deliberately: TouchBistro's flat
                    // square tiles with 1pt hairlines are the look its OWN
                    // accessibility ids call `legacyNumberPadScreen`.
                    <Check size={30} color={color.onPrimary} strokeWidth={2.5} />
                  ) : (
                    <Text style={styles.keyTxt}>{k === "back" ? "⌫" : k}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { rowGap: space.sm },
  row: { flexDirection: "row", marginHorizontal: -HALF_GUTTER },
  cell: { paddingHorizontal: HALF_GUTTER },
  key: {
    borderRadius: radius.card,
    backgroundColor: color.card2,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // Green = go, the same signal TouchBistro gives its ✓ key. The icon carries
  // the meaning too, so colour is never the only cue.
  keyConfirm: { backgroundColor: color.success, borderColor: color.success },
  keyPressed: { opacity: 0.7 },
  keyTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
});
