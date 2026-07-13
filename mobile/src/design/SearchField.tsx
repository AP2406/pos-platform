import { View, TextInput, StyleSheet } from "react-native";
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    minHeight: touch.min,
    justifyContent: "center",
  },
  input: { color: color.text, fontFamily: fontFamily.regular, fontSize: fontSize.body },
});
