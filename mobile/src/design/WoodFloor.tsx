import { View } from "react-native";
import { floor } from "@surge/design-tokens";

const PLANK_H = 44;
const PLANK_LEN = 260; // avg plank length before a butt joint

// Procedural warm light wood-plank floor — horizontal planks with alternating
// tones, a thin seam + top highlight, and staggered vertical butt joints. Pure
// Views (no image asset), so it's self-contained and scales to any size.
export function WoodFloor({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  const rows = Math.ceil(height / PLANK_H) + 1;
  const jointsPerRow = Math.max(1, Math.round(width / PLANK_LEN));
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width, height, backgroundColor: floor.wood, overflow: "hidden" }} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => {
        const stagger = (r % 3) * (PLANK_LEN / 3);
        return (
          <View
            key={r}
            style={{
              position: "absolute",
              left: 0,
              top: r * PLANK_H,
              width,
              height: PLANK_H,
              backgroundColor: r % 2 === 0 ? floor.wood : floor.woodAlt,
              borderBottomWidth: 1,
              borderBottomColor: floor.seam,
            }}
          >
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, backgroundColor: floor.highlight }} />
            {Array.from({ length: jointsPerRow }).map((_, j) => (
              <View key={j} style={{ position: "absolute", top: 0, bottom: 0, left: stagger + j * PLANK_LEN + 70, width: 1, backgroundColor: floor.seam }} />
            ))}
          </View>
        );
      })}
    </View>
  );
}
