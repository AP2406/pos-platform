// Shared floor geometry used by the editor and the live floor so chairs are
// placed identically in both.

import { STOOL_PARENT_KINDS } from "@surge/api-contracts";

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

// Stool positions for a COUNTER, which is a different problem from chairs
// around a table.
//
// chairPositions wraps a table on all four sides, because you can sit all the
// way round one. A bar has a service side and a guest side: stools belong in a
// row along ONE long edge, the way they physically are in a room. Wrapping them
// round a 220x40 counter puts two stools behind the bartender.
//
// The long edge is chosen by the counter's own proportions, and the side is the
// one facing away from the top-left origin — for a horizontal bar that is below
// it, for a vertical bar to its right. A bar drawn against the far wall can be
// rotated in the editor like any other element.
export function stoolPositions(c: Rect, count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  const horizontal = c.w >= c.h;
  const pts: { x: number; y: number }[] = [];
  const span = horizontal ? c.w : c.h;
  for (let i = 0; i < count; i++) {
    // Evenly spaced along the edge, inset by half a gap at each end so the first
    // and last stool are not hanging off the corners.
    const t = span * (i + 1) / (count + 1);
    if (horizontal) {
      pts.push({
        x: Math.round(c.x + t - CHAIR_SIZE / 2),
        y: Math.round(c.y + c.h + OFFSET),
      });
    } else {
      pts.push({
        x: Math.round(c.x + c.w + OFFSET),
        y: Math.round(c.y + t - CHAIR_SIZE / 2),
      });
    }
  }
  return pts;
}

/**
 * Seats for any parent: stools in a row for a counter, chairs around the edges
 * for anything else. One entry point so the editor does not have to know which
 * rule applies where.
 */
export function seatPositions(
  parent: Rect & { kind?: string },
  count: number
): { x: number; y: number }[] {
  return STOOL_PARENT_KINDS.includes(parent.kind ?? "")
    ? stoolPositions(parent, count)
    : chairPositions(parent, count);
}
