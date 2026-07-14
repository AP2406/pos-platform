// Structured allergen tags — mirrors the web lib/allergens.ts. A per-line guest
// allergy alert is compiled from these keys and shown bold red on the KDS + chit.
// Money-independent (an order annotation, never a charge).
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

const LABEL: Record<string, string> = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.label]));

export function allergenLabels(keys: string[] | null | undefined): string[] {
  return (Array.isArray(keys) ? keys : []).map((k) => LABEL[k] ?? k).filter(Boolean);
}

// Compile selected allergen keys into the per-line `allergy` string.
export function allergyString(keys: string[]): string {
  return allergenLabels(keys).join(", ");
}
