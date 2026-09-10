import { Pressable, Text, View, Image, StyleSheet } from "react-native";
import { Plus, type LucideIcon } from "lucide-react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

type IconComponent = LucideIcon;

// Menu item tile — TEXT FIRST. The name is the biggest thing on the tile and
// the price sits directly under it; a small category glyph (Lucide, never emoji)
// anchors the top-left. With a photo, the image fills the tile behind a scrim.
// `dim` (86'd) fades it and swaps the "+" for a "Sold out" tag. Presentation only.
export function MenuTile({
  name,
  price,
  imageUrl,
  Icon,
  dim,
  onPress,
  onLongPress,
  onQuickAdd,
}: {
  name: string;
  price?: string;
  imageUrl?: string | null;
  Icon?: IconComponent;
  dim?: boolean;
  onPress?: () => void;
  onLongPress?: () => void; // fast path: add immediately (picker only if required)
  onQuickAdd?: () => void; // same fast path via the visible "+" affordance
}) {
  const hasImg = !!imageUrl;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={({ pressed }) => [styles.tile, dim && styles.dim, pressed && !dim && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={name + (price ? ", " + price : "") + (dim ? ", sold out" : "")}
    >
      {hasImg ? <Image source={{ uri: imageUrl! }} style={styles.img} resizeMode="cover" /> : null}
      {hasImg ? <View style={styles.scrim} /> : null}

      <View style={styles.top}>
        {Icon ? (
          <View style={[styles.glyph, hasImg && styles.glyphOverImg]}>
            <Icon size={16} color={hasImg ? "#FFFFFF" : color.textDim} strokeWidth={2} />
          </View>
        ) : (
          <View />
        )}
        {dim ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutTxt}>Sold out</Text>
          </View>
        ) : onQuickAdd ? (
          <Pressable onPress={onQuickAdd} hitSlop={10} style={styles.add} accessibilityRole="button" accessibilityLabel={"Add " + name}>
            <Plus size={18} color={color.onPrimary} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.caption}>
        <Text style={[styles.name, hasImg && styles.onImg]} numberOfLines={2}>
          {name}
        </Text>
        {price ? (
          <Text style={[styles.price, hasImg && styles.priceOverImg]} numberOfLines={1}>
            {price}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 156,
    height: 118,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: "#1F2538",
    overflow: "hidden",
    justifyContent: "space-between",
    padding: space.sm + 2,
    minWidth: touch.min * 2,
  },
  pressed: { borderColor: color.blue, backgroundColor: "#222A40" },
  dim: { opacity: 0.55 },
  img: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,8,14,0.55)" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  glyph: { width: 26, height: 26, borderRadius: radius.control, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  glyphOverImg: { backgroundColor: "rgba(0,0,0,0.45)" },
  add: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: color.blue, alignItems: "center", justifyContent: "center" },
  soldOut: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: color.lateSoft, borderWidth: 1, borderColor: color.late },
  soldOutTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: color.late },
  caption: { gap: 1 },
  name: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 21, color: color.text },
  onImg: { color: "#FFFFFF" },
  price: { fontFamily: fontFamily.semibold, fontSize: 15, color: color.textDim, fontVariant: ["tabular-nums"] },
  priceOverImg: { color: "rgba(255,255,255,0.88)" },
});
