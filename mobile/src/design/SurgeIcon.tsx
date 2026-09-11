import Svg, { G, Path } from "react-native-svg";
import { color } from "@surge/design-tokens";

// THE OPTICAL MARK, native. Surge-Logo-Kit-v1 ships dedicated 16/24/32/48
// drawings and its README is explicit that you use those rather than shrinking
// the full logo into that range — each grid has its own stroke weight and its
// own bar lengths, which is what keeps the motif from turning to mush at 24pt
// on a retina iPad. So these are the kit's own path data, not one path scaled.
//
// Drawn in vector rather than shipped as a PNG because a POS runs at three
// different pixel densities and a bitmap at this size shows it. The lockup
// (assets/surge-lockup.png) is the opposite call — see sign-in.tsx.
//
// This app is dark-only (`userInterfaceStyle: "dark"` in app.json), so only the
// kit's dark variant is carried: white outline, kit-blue bars.
const GRID = {
  16: { w: 2, frame: "M6 2 H11 Q14 2 14 5 V11 Q14 14 11 14 H6", bars: "M4 5 H8 M2 8 H8 M4 11 H8" },
  24: { w: 2, frame: "M10 2 H19 Q22 2 22 5 V19 Q22 22 19 22 H10", bars: "M6 7 H12 M2 12 H12 M6 17 H12" },
  32: { w: 3, frame: "M13 3 H26 Q29 3 29 6 V26 Q29 29 26 29 H13", bars: "M8 10 H17 M3 16 H17 M8 22 H17" },
  48: { w: 4, frame: "M19 4 H41 Q44 4 44 7 V41 Q44 44 41 44 H19", bars: "M12 14 H25 M4 24 H25 M12 34 H25" },
} as const;

export function SurgeIcon({ size = 24 }: { size?: 16 | 24 | 32 | 48 }) {
  const g = GRID[size];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G fill="none" strokeWidth={g.w} strokeLinecap="round" strokeLinejoin="round">
        {/* `color.brand` and not `color.blue`: nothing sits on top of the bars,
            so they get the literal kit value rather than the darkened fill. */}
        <Path stroke={color.onPrimary} d={g.frame} />
        <Path stroke={color.brand} d={g.bars} />
      </G>
    </Svg>
  );
}
