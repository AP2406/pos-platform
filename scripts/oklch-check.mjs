// Throwaway: sRGB hex <-> OKLCH + WCAG contrast, so the dark tokens this branch
// aligns to the UI handoff are measured rather than guessed. Not wired into
// anything; run with `node scripts/oklch-check.mjs`.
function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return [enc(lr), enc(lg), enc(lb)].map((v) => Math.min(1, Math.max(0, v)));
}
function srgbToOklch(r8, g8, b8) {
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let hDeg = (Math.atan2(B, A) * 180) / Math.PI;
  if (hDeg < 0) hDeg += 360;
  return [L, C, hDeg];
}
const parse = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const hex = (rgb) =>
  "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (rgb) => {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const S = (l, c, h) => oklchToSrgb(l, c, h);
const fmt = (n, d = 4) => Number(n.toFixed(d));

console.log("--- HANDOFF HEXES -> OKLCH (raw), and the hue-265 fit we actually ship ---");
const HANDOFF = {
  "canvas  #101215": "#101215",
  "sidebar #15171b": "#15171b",
  "cards   #1a1d22": "#1a1d22",
  "borders #2c3037": "#2c3037",
  "sec-fg  #a5acb8": "#a5acb8",
  "blue    #008cff": "#008cff",
};
for (const [name, h] of Object.entries(HANDOFF)) {
  const [L, C, H] = srgbToOklch(...parse(h));
  console.log(
    name.padEnd(18),
    `oklch(${fmt(L, 4)} ${fmt(C, 4)} ${fmt(H, 1)})`.padEnd(30),
    "round-trip", hex(S(L, C, H))
  );
}

// The file's neutral convention is hue 265. Snap each neutral to 265 and find
// the chroma that lands closest to the target hex.
console.log("\n--- snapped to the file's hue-265 neutral convention ---");
const fit = (target, hue) => {
  const t = parse(target).map((v) => v / 255);
  let best = null;
  for (let L = 0.05; L <= 0.999; L += 0.0005) {
    for (let C = 0; C <= 0.06; C += 0.0005) {
      const rgb = S(L, C, hue);
      const d = Math.hypot(rgb[0] - t[0], rgb[1] - t[1], rgb[2] - t[2]);
      if (!best || d < best.d) best = { L, C, d, rgb };
    }
  }
  return best;
};
for (const [name, h] of Object.entries(HANDOFF)) {
  if (name.startsWith("blue")) continue;
  const b = fit(h, 265);
  console.log(name.padEnd(18), `oklch(${fmt(b.L, 3)} ${fmt(b.C, 3)} 265)`.padEnd(26), "->", hex(b.rgb), "target", h.toUpperCase());
}

console.log("\n--- what the dark theme ships TODAY (the 'before' column) ---");
for (const [name, l, c, h] of [
  ["--background", 0.145, 0.012, 265],
  ["--sidebar", 0.115, 0.011, 265],
  ["--card", 0.205, 0.016, 265],
  ["--border (14% white on card)", 0.205, 0.016, 265],
  ["--muted-foreground", 0.75, 0.022, 265],
  ["--foreground", 0.98, 0.004, 265],
  ["--raised", 0.245, 0.017, 265],
  ["--surface-2", 0.265, 0.02, 265],
  ["--popover", 0.275, 0.019, 265],
  ["--accent", 0.29, 0.02, 265],
  ["--secondary", 0.245, 0.017, 265],
]) console.log(name.padEnd(30), hex(S(l, c, h)));

console.log("\n--- contrast, dark theme, AFTER the alignment ---");
const canvas = S(0.181, 0.007, 265);   // #101215
const rail = S(0.204, 0.009, 265);     // #15171b
const card = S(0.23, 0.011, 265);      // #1a1d22
const line = S(0.308, 0.014, 265);     // #2c3037
const secFg = S(0.742, 0.02, 265);     // #a5acb8
const white = S(1, 0, 0);
const blue = S(0.64, 0.2, 253);        // #008CFF
const ink = S(0.16, 0.02, 265);
const rows = [
  ["white text on canvas", S(0.98, 0.004, 265), canvas],
  ["white text on card", S(0.98, 0.004, 265), card],
  ["secondary #a5acb8 on canvas", secFg, canvas],
  ["secondary #a5acb8 on card", secFg, card],
  ["secondary #a5acb8 on rail", secFg, rail],
  ["border #2c3037 on card", line, card],
  ["border #2c3037 on canvas", line, canvas],
  ["card vs canvas (surface step)", card, canvas],
  ["rail vs canvas (surface step)", rail, canvas],
  ["BLUE #008CFF + WHITE label (handoff asks)", white, blue],
  ["BLUE #008CFF + ink label (what we ship)", ink, blue],
  ["blue #008CFF as a ring on canvas", blue, canvas],
  ["blue #008CFF as a ring on card", blue, card],
];
for (const [name, fg, bg] of rows) {
  console.log(name.padEnd(44), ratio(fg, bg).toFixed(2) + ":1");
}

console.log("\n--- the surface ladder above 'card', step-preserved ---");
// Current dark ladder: canvas .145 / card .205 / raised .245 / popover .275.
// Steps above card: +0.040 (raised), +0.070 (popover), +0.060 (surface-2 .265),
// +0.085 (accent .29). Re-applied to the new card at 0.185.
for (const [name, L] of [["raised/secondary", 0.27], ["surface-2", 0.29], ["popover/overlay", 0.3], ["accent", 0.315]]) {
  const rgb = S(L, 0.013, 265);
  console.log(name.padEnd(18), `oklch(${L} 0.013 265)`.padEnd(26), hex(rgb), "vs card", ratio(rgb, card).toFixed(2) + ":1", "vs canvas", ratio(rgb, canvas).toFixed(2) + ":1");
}
console.log("\n--- white text: pure white vs the current near-white, on the new surfaces ---");
for (const [name, fg] of [["oklch(1 0 0)", white], ["oklch(0.98 0.004 265)", S(0.98, 0.004, 265)]]) {
  console.log(name.padEnd(24), "canvas", ratio(fg, canvas).toFixed(2), "card", ratio(fg, card).toFixed(2), "rail", ratio(fg, rail).toFixed(2));
}

console.log("\n--- /login (dark): the panel/card ladder, re-derived off the new canvas ---");
for (const [name, L, C] of [["auth-panel", 0.215, 0.012], ["auth-card", 0.26, 0.013], ["auth-bar idle", 0.37, 0.016]]) {
  const rgb = S(L, C, 265);
  console.log(name.padEnd(16), `oklch(${L} ${C} 265)`.padEnd(26), hex(rgb), "vs canvas", ratio(rgb, canvas).toFixed(2) + ":1", "vs panel", ratio(rgb, S(0.215, 0.012, 265)).toFixed(2) + ":1");
}
console.log("auth-panel-fg white on panel", ratio(white, S(0.215, 0.012, 265)).toFixed(2) + ":1");
console.log("auth-panel-muted #a5acb8 on panel", ratio(secFg, S(0.215, 0.012, 265)).toFixed(2) + ":1");
console.log("auth-bar-peak #008CFF on auth-card", ratio(blue, S(0.26, 0.013, 265)).toFixed(2) + ":1");

console.log("\n--- floor tiles (dark): subdued slate + status DOT, not a colour slab ---");
const slate = S(0.27, 0.013, 265);
const avail = S(0.23, 0.011, 265);
console.log("occupied slate fill", hex(slate), "vs canvas", ratio(slate, canvas).toFixed(2) + ":1");
console.log("available fill     ", hex(avail), "vs canvas", ratio(avail, canvas).toFixed(2) + ":1");
console.log("white label on slate", ratio(white, slate).toFixed(2) + ":1");
console.log("#a5acb8 on slate   ", ratio(secFg, slate).toFixed(2) + ":1");
for (const [name, l, c, h] of [["seated border", 0.37, 0.016, 265], ["warn border", 0.42, 0.06, 75], ["late border", 0.42, 0.08, 25]]) {
  const rgb = S(l, c, h);
  console.log(name.padEnd(16), `oklch(${l} ${c} ${h})`.padEnd(24), hex(rgb), "vs fill", ratio(rgb, slate).toFixed(2) + ":1");
}

console.log("\n--- status accents: muted green / amber dots on the new card ---");
for (const [name, l, c, h] of [
  ["green dot", 0.72, 0.14, 155],
  ["amber dot", 0.78, 0.14, 75],
  ["red dot", 0.63, 0.19, 25],
]) {
  const rgb = S(l, c, h);
  console.log(name.padEnd(18), `oklch(${l} ${c} ${h})`.padEnd(26), hex(rgb), "vs card", ratio(rgb, card).toFixed(2) + ":1", "vs canvas", ratio(rgb, canvas).toFixed(2) + ":1");
}
