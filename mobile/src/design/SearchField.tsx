import { View, TextInput, StyleSheet } from "react-native";
import { Search } from "lucide-react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Search size={18} color={color.textFaint} strokeWidth={2.25} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.card2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    minHeight: touch.min,
  },
  input: { flex: 1, color: color.text, fontFamily: fontFamily.regular, fontSize: fontSize.body, paddingVertical: 0 },
});
