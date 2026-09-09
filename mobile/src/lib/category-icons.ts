// Distinct Lucide icon per menu category — keyword match on the category name,
// with a stable fallback so every category still reads as its own thing.
// Money-independent presentation helper. Icons are line glyphs (not emoji) so
// they scale, tint, and align with the rest of the UI.
import {
  type LucideIcon,
  Utensils,
  UtensilsCrossed,
  Salad,
  Soup,
  Pizza,
  Sandwich,
  Fish,
  Drumstick,
  Beef,
  Croissant,
  EggFried,
  CakeSlice,
  Coffee,
  Beer,
  Wine,
  Martini,
  CupSoda,
  Citrus,
  Baby,
  Star,
  Popcorn,
  Cookie,
  Wheat,
  CookingPot,
  HandPlatter,
  IceCreamCone,
  Leaf,
} from "lucide-react-native";

export type IconComponent = LucideIcon;

const RULES: { test: RegExp; icon: IconComponent }[] = [
  { test: /\ball|everything\b/i, icon: UtensilsCrossed },
  { test: /appet|starter|small|share|tapas/i, icon: HandPlatter },
  { test: /salad|green|veg/i, icon: Salad },
  { test: /soup|stew|chowder/i, icon: Soup },
  { test: /pizza|flatbread/i, icon: Pizza },
  { test: /burger|sandwich|wrap|sub|panini/i, icon: Sandwich },
  { test: /taco|burrito|mexi|nacho/i, icon: Popcorn },
  { test: /sushi|roll|maki|sashimi|seafood|fish|shrimp|oyster/i, icon: Fish },
  { test: /noodle|ramen|pho|pasta|risotto/i, icon: CookingPot },
  { test: /chicken|wing|poultry/i, icon: Drumstick },
  { test: /steak|meat|grill|chop/i, icon: Beef },
  { test: /entr|main|dinner|plate/i, icon: Utensils },
  { test: /side|fries|snack/i, icon: Cookie },
  { test: /bread|bake|bakery|pastry/i, icon: Croissant },
  { test: /breakfast|brunch|egg/i, icon: EggFried },
  { test: /ice|gelato|sorbet/i, icon: IceCreamCone },
  { test: /dessert|sweet|cake/i, icon: CakeSlice },
  { test: /coffee|espresso|latte|tea|cafe/i, icon: Coffee },
  { test: /beer|draft|lager|ale/i, icon: Beer },
  { test: /wine/i, icon: Wine },
  { test: /cocktail|spirit|liquor|bar/i, icon: Martini },
  { test: /juice|smoothie|drink|beverage|soda|pop|soft/i, icon: CupSoda },
  { test: /kid|child/i, icon: Baby },
  { test: /special|feature|chef/i, icon: Star },
  { test: /grain|rice|bowl/i, icon: Wheat },
  { test: /vegan|plant/i, icon: Leaf },
];

// Deterministic fallback: pick from a small set by a hash of the name so the
// same category always gets the same icon (no Math.random).
const FALLBACK: IconComponent[] = [CookingPot, HandPlatter, Utensils, Citrus, Wheat, Leaf];

export function categoryIcon(name: string | null | undefined): IconComponent {
  const n = (name || "").trim();
  if (!n) return UtensilsCrossed;
  for (const r of RULES) if (r.test.test(n)) return r.icon;
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
