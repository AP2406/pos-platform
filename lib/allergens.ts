// Structured allergen tags for menu items. Keys are stable; labels are shown in
// the catalog editor and rendered (bold red) on the KDS + printed chit.
export const ALLERGENS: { key: string; label: string }[] = [
  { key: "peanuts", label: "Peanuts" },
  { key: "tree_nuts", label: "Tree nuts" },
  { key: "milk", label: "Milk" },
  { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" },
  { key: "shellfish", label: "Shellfish" },
  { key: "soy", label: "Soy" },
  { key: "gluten", label: "Gluten" },
  { key: "sesame", label: "Sesame" },
  { key: "mustard", label: "Mustard" },
  { key: "sulphites", label: "Sulphites" },
];

export const ALLERGEN_KEYS = ALLERGENS.map((a) => a.key);

const ALLERGEN_LABEL: Record<string, string> = Object.fromEntries(
  ALLERGENS.map((a) => [a.key, a.label])
);

export function allergenLabels(keys: string[] | null | undefined): string[] {
  return (Array.isArray(keys) ? keys : [])
    .map((k) => ALLERGEN_LABEL[k] ?? k)
    .filter(Boolean);
}

export function cleanAllergens(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const set = new Set(ALLERGEN_KEYS);
  return Array.from(new Set(keys.filter((k): k is string => typeof k === "string" && set.has(k))));
}
