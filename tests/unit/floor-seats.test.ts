import { describe, it, expect } from "vitest";
import {
  CHAIR_SIZE,
  chairPositions,
  seatPositions,
  stoolPositions,
} from "@/app/app/pos/floor-style";

// Seat geometry for the floor plan, shared by the editor (settings/floor-card)
// and both live floors (web pos/floor-client, mobile app/floor).
//
// WHY A BAR NEEDS ITS OWN RULE. chairPositions wraps a rectangle on all four
// sides, which is correct for a table — you can sit all the way round one. Run
// the same function over a 220x40 counter and it puts two chairs on the short
// ends and one row BEHIND the bar, where the bartender stands. A bar has a
// service side and a guest side, so its seats belong in a single row along one
// long edge. That is the whole difference, and it is the reason a counter could
// not simply be added to the editor's SEATABLE list without this.

const bar = { x: 100, y: 200, w: 220, h: 40 };
const table = { x: 0, y: 0, w: 80, h: 80 };

describe("bar stools", () => {
  it("puts every stool on the same side of the bar", () => {
    const pts = stoolPositions(bar, 8);
    expect(pts).toHaveLength(8);
    const ys = new Set(pts.map((p) => p.y));
    expect(ys.size, "stools should share one edge, not wrap the counter").toBe(1);
  });

  it("puts them in front of the bar, not behind it", () => {
    // Behind is above (smaller y) for a horizontal counter — that is where the
    // person pouring stands.
    const [first] = stoolPositions(bar, 6);
    expect(first.y).toBeGreaterThan(bar.y + bar.h);
  });

  it("spaces them evenly and in order along the bar", () => {
    const xs = stoolPositions(bar, 5).map((p) => p.x);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs); // left to right
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1); // rounding only
  });

  it("keeps the end stools on the bar rather than off its corners", () => {
    // The inset matters: a stool centred on the very end of the counter reads
    // as belonging to whatever is next to the bar.
    const pts = stoolPositions(bar, 4);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(bar.x - CHAIR_SIZE / 2);
      expect(p.x + CHAIR_SIZE).toBeLessThanOrEqual(bar.x + bar.w + CHAIR_SIZE / 2);
    }
  });

  it("runs down the right-hand side when the bar is drawn vertically", () => {
    const tall = { x: 40, y: 40, w: 40, h: 220 };
    const pts = stoolPositions(tall, 6);
    expect(new Set(pts.map((p) => p.x)).size).toBe(1);
    expect(pts[0].x).toBeGreaterThan(tall.x + tall.w);
    expect([...pts.map((p) => p.y)].sort((a, b) => a - b)).toEqual(pts.map((p) => p.y));
  });

  it("draws nothing for a bar with no stools", () => {
    // A counter is a perfectly good element on its own — a service pass, a
    // host stand — so zero is a real answer, not a missing one.
    expect(stoolPositions(bar, 0)).toEqual([]);
    expect(stoolPositions(bar, -3)).toEqual([]);
  });

  it("never stacks two stools in the same place", () => {
    const pts = stoolPositions(bar, 12);
    expect(new Set(pts.map((p) => p.x + ":" + p.y)).size).toBe(12);
  });
});

describe("seatPositions picks the rule from the parent", () => {
  it("lays a counter's seats out as stools", () => {
    expect(seatPositions({ ...bar, kind: "counter" }, 6)).toEqual(stoolPositions(bar, 6));
  });

  it("lays a station's seats out as stools too", () => {
    // Both floors already treat a station-parented seat as a stool when they
    // draw it; the geometry has to agree with that or the drawing is wrong.
    const st = { x: 10, y: 10, w: 60, h: 60 };
    expect(seatPositions({ ...st, kind: "station" }, 3)).toEqual(stoolPositions(st, 3));
  });

  it("still wraps a table, which is what a table wants", () => {
    expect(seatPositions({ ...table, kind: "table" }, 4)).toEqual(chairPositions(table, 4));
    expect(new Set(chairPositions(table, 4).map((p) => p.y)).size).toBeGreaterThan(1);
  });

  it("treats an unknown parent as a table rather than a bar", () => {
    // Booths, and anything added to the palette later, should keep the old
    // behaviour until someone decides otherwise.
    expect(seatPositions({ ...table, kind: "booth" }, 4)).toEqual(chairPositions(table, 4));
    expect(seatPositions({ ...table }, 4)).toEqual(chairPositions(table, 4));
  });

  it("would have put stools behind the bartender under the old rule", () => {
    // Pinning the defect this replaced, so nobody "simplifies" seatPositions
    // back down to chairPositions without seeing what it costs.
    const wrapped = chairPositions(bar, 8);
    const behind = wrapped.filter((p) => p.y < bar.y);
    expect(behind.length).toBeGreaterThan(0);

    const rowed = stoolPositions(bar, 8);
    expect(rowed.filter((p) => p.y < bar.y)).toHaveLength(0);
  });
});
