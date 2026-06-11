// Run: node --experimental-strip-types app/app/pos/split-math.test.ts
// Pure unit + fuzz tests for the split allocators. The contract that matters:
// every allocation sums to its input EXACTLY (the conservation invariant), with
// non-negative shares and deterministic tie-breaking.
import { allocateEqual, allocateWeighted } from "./split-math.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + name);
  }
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// --- worked examples from the brief ---
check("equal 1000/3", JSON.stringify(allocateEqual(1000, 3)) === JSON.stringify([334, 333, 333]));
check("equal 7571/2", JSON.stringify(allocateEqual(7571, 2)) === JSON.stringify([3786, 3785]));
// tax 871 by taxable subtotals [3750, 2950] -> [488, 383] (leftover penny to larger frac=Seat1)
check("weighted tax 871 by [3750,2950]", JSON.stringify(allocateWeighted(871, [3750, 2950])) === JSON.stringify([488, 383]));
// exact-frac tie -> larger weight wins the penny
check("weighted tie -> larger weight", JSON.stringify(allocateWeighted(1, [3, 1])) === JSON.stringify([1, 0]));
check("weighted all-zero weights", JSON.stringify(allocateWeighted(500, [0, 0, 0])) === JSON.stringify([500, 0, 0]));
check("weighted zero total", JSON.stringify(allocateWeighted(0, [5, 3])) === JSON.stringify([0, 0]));

// --- fuzz: both allocators always conserve, non-negative ---
function rnd(seed: { s: number }) {
  // deterministic LCG so the test is reproducible
  seed.s = (seed.s * 1103515245 + 12345) & 0x7fffffff;
  return seed.s / 0x7fffffff;
}
const seed = { s: 987654321 };
let fuzz = 0;
for (let t = 0; t < 200000; t++) {
  const A = Math.floor(rnd(seed) * 2000000); // up to $20,000
  const N = 1 + Math.floor(rnd(seed) * 12);

  const eq = allocateEqual(A, N);
  check("fuzz equal sum", sum(eq) === A);
  check("fuzz equal nonneg", eq.every((x) => x >= 0));
  check("fuzz equal len", eq.length === N);
  // equal shares differ by at most 1
  check("fuzz equal spread<=1", Math.max(...eq) - Math.min(...eq) <= 1);

  const weights = Array.from({ length: N }, () => Math.floor(rnd(seed) * 5000));
  const w = allocateWeighted(A, weights);
  check("fuzz weighted sum", sum(w) === A);
  check("fuzz weighted nonneg", w.every((x) => x >= 0));
  check("fuzz weighted len", w.length === N);
  fuzz++;
}

console.log("ran " + fuzz + " fuzz rounds");
if (failures === 0) console.log("ALL PASS");
else { console.error(failures + " FAILURES"); process.exit(1); }
