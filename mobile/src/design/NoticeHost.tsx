import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";
import { subscribeNotice } from "../lib/notice";

// Renders app notices as a slim TOP banner: auto-dismisses (4s), tap to dismiss,
// and its container is pointer-transparent so it never blocks tappable UI beneath
// (unlike the old dev overlay that covered the sheet rows). Mount once, app-wide.
export function NoticeHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeNotice((m) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 4000);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + space.xs }]}>
      <Pressable onPress={() => setMsg(null)} style={styles.banner} accessibilityRole="alert">
        <Text style={styles.txt} numberOfLines={2}>
          {msg}
        </Text>
        <Text style={styles.x}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: space.lg, zIndex: 1000 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    maxWidth: 560,
    width: "100%",
    backgroundColor: color.card2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.late,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  txt: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.text },
  x: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.textDim },
});
