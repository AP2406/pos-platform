import { Pressable, Text, View, Image, StyleSheet } from "react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

// Menu item tile. With a photo it renders the image + a legibility scrim behind
// the name/price; without one it falls back to a category icon on a tinted block
// so every tile still reads cleanly. `dim` (86'd) fades it. Presentation only.
export function MenuTile({
  name,
  price,
  imageUrl,
  fallbackIcon,
  dim,
  onPress,
}: {
  name: string;
  price?: string;
  imageUrl?: string | null;
  fallbackIcon?: string;
  dim?: boolean;
  onPress?: () => void;
}) {
  const hasImg = !!imageUrl;
  return (
    <Pressable onPress={onPress} style={[styles.tile, dim && styles.dim]} accessibilityRole="button">
      {hasImg ? (
        <Image source={{ uri: imageUrl! }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackIcon}>{fallbackIcon ?? "🍽️"}</Text>
        </View>
      )}
      <View style={[styles.caption, hasImg && styles.captionOverImg]}>
        <Text style={[styles.name, hasImg && styles.nameOverImg]} numberOfLines={2}>
          {name}
        </Text>
        {price ? <Text style={[styles.price, hasImg && styles.priceOverImg]}>{price}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 132,
    height: 128,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card2,
    overflow: "hidden",
    justifyContent: "flex-end",
    minWidth: touch.min * 2,
  },
  dim: { opacity: 0.45 },
  img: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: color.card2 },
  fallbackIcon: { fontSize: 40, opacity: 0.9 },
  caption: { padding: space.sm },
  captionOverImg: { backgroundColor: "rgba(0,0,0,0.55)" },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  nameOverImg: { color: "#fff" },
  price: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim, marginTop: 2 },
  priceOverImg: { color: "rgba(255,255,255,0.85)" },
});
