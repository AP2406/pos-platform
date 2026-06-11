// Money allocation for check splitting. Pure, integer-cents, deterministic.
// Every division of a money amount across sub-checks goes through these so the
// parts always sum to the input EXACTLY (the conservation invariant). Shared by
// the server (split-actions) and the builder UI (split-sheet).

// Equal split of `totalCents` into `n` shares. The first `rem` shares get the
// extra penny. Sum === totalCents.
//   allocateEqual(1000, 3) -> [334, 333, 333]
export function allocateEqual(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const out = new Array<number>(n).fill(base);
  let rem = totalCents - base * n;
  for (let i = 0; rem > 0; i++, rem--) out[i] += 1;
  return out;
}

// Weighted (proportional) split of `totalCents` across buckets by `weights`.
// Each bucket gets floor(total * w / Σw); the leftover pennies go to the buckets
// with the largest fractional remainder, tie-broken by larger weight, then lower
// index. Sum === totalCents.
export function allocateWeighted(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0 || totalCents === 0) return out;
  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0) {
    // No weight anywhere: put it all on the first bucket rather than lose it.
    out[0] = totalCents;
    return out;
  }
  const raw = weights.map((w) => (totalCents * w) / W);
  const floors = raw.map((x) => Math.floor(x));
  const leftover = totalCents - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x), w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (let k = 0; k < leftover; k++) floors[order[k].i] += 1;
  return floors;
}
