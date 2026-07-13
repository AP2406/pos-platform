import { Pressable, Text, StyleSheet } from "react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

export function MenuTile({ name, price, onPress }: { name: string; price?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tile} accessibilityRole="button">
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      {price ? <Text style={styles.price}>{price}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: color.card2,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
    minHeight: touch.min * 1.5,
    minWidth: touch.min * 2,
    justifyContent: "space-between",
  },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  price: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim, marginTop: space.sm },
});
