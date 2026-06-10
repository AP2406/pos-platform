// Shared category-color palette for register tiles and the catalog color picker.
//
// Colors are merchant-assigned: businesses.category_colors stores a map of
// { "<category name>": "<palette key>" }. The register and the catalog both
// resolve a category's tile classes through this single source of truth so the
// color stays consistent everywhere. Categories with no assigned key (or no
// category at all) fall back to a neutral tile.

export type PaletteEntry = {
  key: string;
  label: string;
  // Classes for a register tile: tinted background, colored border, readable
  // text in both light and dark themes.
  tile: string;
  // Solid color for the picker swatch dot.
  swatch: string;
};

export const CATEGORY_PALETTE: PaletteEntry[] = [
  { key: "slate", label: "Slate", tile: "bg-slate-500/10 border-slate-500/40 text-foreground", swatch: "bg-slate-500" },
  { key: "red", label: "Red", tile: "bg-red-500/10 border-red-500/45 text-foreground", swatch: "bg-red-500" },
  { key: "orange", label: "Orange", tile: "bg-orange-500/10 border-orange-500/45 text-foreground", swatch: "bg-orange-500" },
  { key: "amber", label: "Amber", tile: "bg-amber-500/10 border-amber-500/45 text-foreground", swatch: "bg-amber-500" },
  { key: "green", label: "Green", tile: "bg-green-500/10 border-green-500/45 text-foreground", swatch: "bg-green-500" },
  { key: "teal", label: "Teal", tile: "bg-teal-500/10 border-teal-500/45 text-foreground", swatch: "bg-teal-500" },
  { key: "blue", label: "Blue", tile: "bg-blue-500/10 border-blue-500/45 text-foreground", swatch: "bg-blue-500" },
  { key: "indigo", label: "Indigo", tile: "bg-indigo-500/10 border-indigo-500/45 text-foreground", swatch: "bg-indigo-500" },
  { key: "violet", label: "Violet", tile: "bg-violet-500/10 border-violet-500/45 text-foreground", swatch: "bg-violet-500" },
  { key: "pink", label: "Pink", tile: "bg-pink-500/10 border-pink-500/45 text-foreground", swatch: "bg-pink-500" },
];

const NEUTRAL_TILE =
  "bg-card border-border text-foreground hover:border-foreground/40 hover:bg-accent/50";

const TILE_BY_KEY: Record<string, string> = {};
for (const p of CATEGORY_PALETTE) TILE_BY_KEY[p.key] = p.tile;

const SWATCH_BY_KEY: Record<string, string> = {};
for (const p of CATEGORY_PALETTE) SWATCH_BY_KEY[p.key] = p.swatch;

// Tile classes for a category given the merchant's color map. Returns neutral
// classes when the category is empty or has no assigned color.
export function tileClassesFor(
  category: string | null | undefined,
  colorMap: Record<string, string> | null | undefined
): string {
  const name = (category || "").trim();
  if (!name || !colorMap) return NEUTRAL_TILE;
  const key = colorMap[name];
  if (key && TILE_BY_KEY[key]) return TILE_BY_KEY[key];
  return NEUTRAL_TILE;
}

// Solid swatch class for an assigned key, or empty string when unset.
export function swatchClassFor(key: string | null | undefined): string {
  if (!key) return "";
  return SWATCH_BY_KEY[key] || "";
}
