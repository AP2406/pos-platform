// Shared floor geometry used by the editor and the live floor so chairs are
// placed identically in both.

export const CHAIR_SIZE = 18;
const OFFSET = 8; // gap between the table edge and its chairs

type Rect = { x: number; y: number; w: number; h: number };

// Even positions (top-left coords) for `count` chairs hugging a table's edges.
// Wide tables seat more on top/bottom; tall tables on the sides.
export function chairPositions(t: Rect, count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  const sides = { top: 0, bottom: 0, left: 0, right: 0 };
  const order: ("top" | "bottom" | "left" | "right")[] =
    t.w >= t.h ? ["top", "bottom", "left", "right"] : ["left", "right", "top", "bottom"];
  for (let i = 0; i < count; i++) sides[order[i % 4]]++;

  const along = (n: number, length: number, start: number): number[] => {
    const arr: number[] = [];
    for (let i = 0; i < n; i++) arr.push(start + (length * (i + 1)) / (n + 1));
    return arr;
  };

  const pts: { x: number; y: number }[] = [];
  for (const cx of along(sides.top, t.w, t.x)) pts.push({ x: Math.round(cx - CHAIR_SIZE / 2), y: Math.round(t.y - OFFSET - CHAIR_SIZE) });
  for (const cx of along(sides.bottom, t.w, t.x)) pts.push({ x: Math.round(cx - CHAIR_SIZE / 2), y: Math.round(t.y + t.h + OFFSET) });
  for (const cy of along(sides.left, t.h, t.y)) pts.push({ x: Math.round(t.x - OFFSET - CHAIR_SIZE), y: Math.round(cy - CHAIR_SIZE / 2) });
  for (const cy of along(sides.right, t.h, t.y)) pts.push({ x: Math.round(t.x + t.w + OFFSET), y: Math.round(cy - CHAIR_SIZE / 2) });
  return pts;
}
