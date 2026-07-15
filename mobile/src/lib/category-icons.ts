// Distinct icon per menu category — keyword match on the category name, with a
// stable emoji fallback so every category still reads as its own thing. Emoji
// only (no icon-font dependency). Money-independent presentation helper.

const RULES: { test: RegExp; icon: string }[] = [
  { test: /\ball|everything\b/i, icon: "🍴" },
  { test: /appet|starter|small|share|tapas/i, icon: "🥟" },
  { test: /salad|green/i, icon: "🥗" },
  { test: /soup/i, icon: "🍜" },
  { test: /pizza/i, icon: "🍕" },
  { test: /burger/i, icon: "🍔" },
  { test: /sandwich|wrap|sub|panini/i, icon: "🥪" },
  { test: /taco|burrito|mexi|nacho/i, icon: "🌮" },
  { test: /sushi|roll|maki|sashimi/i, icon: "🍣" },
  { test: /noodle|ramen|pho|pasta/i, icon: "🍜" },
  { test: /entr|main|dinner|plate|grill|steak|meat/i, icon: "🍽️" },
  { test: /chicken|wing|poultry/i, icon: "🍗" },
  { test: /seafood|fish|shrimp|oyster/i, icon: "🦐" },
  { test: /side|fries|snack/i, icon: "🍟" },
  { test: /bread|bake|bakery|pastry/i, icon: "🥐" },
  { test: /breakfast|brunch|egg/i, icon: "🍳" },
  { test: /dessert|sweet|cake|ice/i, icon: "🍰" },
  { test: /coffee|espresso|latte|tea|cafe/i, icon: "☕" },
  { test: /beer|draft|lager|ale/i, icon: "🍺" },
  { test: /wine/i, icon: "🍷" },
  { test: /cocktail|spirit|liquor|bar/i, icon: "🍸" },
  { test: /juice|smoothie/i, icon: "🧃" },
  { test: /drink|beverage|soda|pop|soft/i, icon: "🥤" },
  { test: /kid|child/i, icon: "🧒" },
  { test: /special|feature|chef/i, icon: "⭐" },
];

// Deterministic fallback: pick from a small palette by a hash of the name so the
// same category always gets the same icon (no Math.random).
const FALLBACK = ["🍲", "🫕", "🥘", "🍱", "🧆", "🥧"];

export function categoryIcon(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "🍴";
  for (const r of RULES) if (r.test.test(n)) return r.icon;
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
