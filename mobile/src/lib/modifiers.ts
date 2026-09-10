// Pure forced-modifier engine — ported from the web POS (register-client.tsx).
// No React, no I/O: given a menu item's group tree + the current selection, it
// computes what's active, what's still required, and the resulting cart line
// (name, unit price, structured modifiers). Money-INDEPENDENT: it shapes the
// order, never a charge. Prices are list prices folded into unit_price exactly as
// the web does, so the /api/v1/quote tax preview matches the eventual charge.

export type ModPosition = "whole" | "left" | "right";
export type ModOption = { id: string; name: string; price: number; child_group?: ModifierGroup };
export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number | null; // null = unlimited
  allow_split: boolean; // half / left-right (pizza-style)
  options: ModOption[];
};
export type Variation = { id: string; name: string; price: number };
export type LineModifier = {
  modifier_id: string | null;
  group_id: string | null;
  group_name: string | null;
  name: string;
  price: number;
  position?: ModPosition;
};

// Every option in a group's subtree (used for pricing, names, subtree clears).
export function flatOptions(groups: ModifierGroup[]): ModOption[] {
  const out: ModOption[] = [];
  const walk = (g: ModifierGroup) => {
    for (const o of g.options) {
      out.push(o);
      if (o.child_group) walk(o.child_group);
    }
  };
  for (const g of groups) walk(g);
  return out;
}

// The group an option belongs to, searching the whole nested tree.
export function groupOf(groups: ModifierGroup[], optId: string): ModifierGroup | undefined {
  let found: ModifierGroup | undefined;
  const walk = (g: ModifierGroup) => {
    if (g.options.some((o) => o.id === optId)) found = g;
    for (const o of g.options) if (o.child_group) walk(o.child_group);
  };
  for (const g of groups) walk(g);
  return found;
}

export function descendantOptionIds(g: ModifierGroup): string[] {
  const ids: string[] = [];
  for (const o of g.options) {
    ids.push(o.id);
    if (o.child_group) ids.push(...descendantOptionIds(o.child_group));
  }
  return ids;
}

// Toggle one option, honoring single-select (replace) and max-select (block).
// Deselecting also clears anything chosen in that option's follow-up subtree.
export function toggleMod(groups: ModifierGroup[], selected: string[], id: string): string[] {
  const g = groupOf(groups, id);
  const opt = g?.options.find((o) => o.id === id);
  if (selected.includes(id)) {
    let next = selected.filter((x) => x !== id);
    if (opt?.child_group) {
      const sub = new Set(descendantOptionIds(opt.child_group));
      next = next.filter((x) => !sub.has(x));
    }
    return next;
  }
  if (g && g.max_select === 1) {
    const drop = new Set<string>();
    for (const o of g.options) {
      drop.add(o.id);
      if (o.child_group) descendantOptionIds(o.child_group).forEach((x) => drop.add(x));
    }
    return [...selected.filter((x) => !drop.has(x)), id];
  }
  if (g && g.max_select != null) {
    const inGroup = selected.filter((x) => g.options.some((o) => o.id === x)).length;
    if (inGroup >= g.max_select) return selected; // at the group's max — ignore
  }
  return [...selected, id];
}

// Groups currently in play: top-level always; a child group only once its parent
// option is selected. Required active groups gate confirm.
export function activeGroups(groups: ModifierGroup[], selected: string[]): ModifierGroup[] {
  const out: ModifierGroup[] = [];
  const walk = (g: ModifierGroup) => {
    out.push(g);
    for (const o of g.options) if (o.child_group && selected.includes(o.id)) walk(o.child_group);
  };
  for (const g of groups) walk(g);
  return out;
}

// Effective minimum for a group (required forces at least 1).
export function groupMin(g: ModifierGroup): number {
  return g.required ? Math.max(1, g.min_select) : g.min_select;
}

export function countInGroup(g: ModifierGroup, selected: string[]): number {
  return selected.filter((x) => g.options.some((o) => o.id === x)).length;
}

// Active groups whose minimum isn't met yet — these block Send-to-kitchen.
export function requiredUnmet(groups: ModifierGroup[], selected: string[]): ModifierGroup[] {
  return activeGroups(groups, selected).filter((g) => {
    const min = groupMin(g);
    return min > 0 && countInGroup(g, selected) < min;
  });
}

// An item must open the picker (no quick-add) when it has variations or any group
// that forces a choice — so a line can never exist with unmet required groups.
export function itemNeedsSheet(item: { variations: Variation[]; modifierGroups: ModifierGroup[] }): boolean {
  if (item.variations.length > 0) return true;
  return item.modifierGroups.some((g) => g.options.length > 0);
}

// The lighter gate for FAST quick-add: only force the picker when a choice is
// genuinely required — a size/variation, or a top-level group with a minimum.
// Optional-only add-ons don't block a quick-add (the base line is valid; a server
// can still edit it). Nested required groups can't be unmet until their parent
// option is chosen, so only top-level minimums matter at add time.
export function itemRequiresChoice(item: { variations: Variation[]; modifierGroups: ModifierGroup[] }): boolean {
  if (item.variations.length > 0) return true;
  return item.modifierGroups.some((g) => groupMin(g) > 0);
}

export type BuiltLine = { name: string; unitPrice: number; variationId: string | null; modifiers: LineModifier[] };

// Compose the cart line from the current selection: unit price = base/variation +
// Σ chosen option prices; name carries variation + "+ ½L Topping" position labels;
// modifiers[] is the structured record (price already inside unitPrice).
export function buildLine(
  item: { id: string; name: string; price: number; variations: Variation[]; modifierGroups: ModifierGroup[] },
  variationId: string | null,
  selected: string[],
  positions: Record<string, ModPosition>
): BuiltLine {
  let unit = item.price;
  let label = item.name;
  let varId: string | null = null;
  if (item.variations.length > 0) {
    const v = item.variations.find((x) => x.id === variationId) ?? item.variations[0];
    varId = v.id;
    unit = v.price;
    label = item.name + " - " + v.name;
  }
  const all = flatOptions(item.modifierGroups);
  const chosen = all.filter((o) => selected.includes(o.id));
  const modTotal = chosen.reduce((s, o) => s + o.price, 0);
  const modifiers: LineModifier[] = chosen.map((o) => {
    const grp = groupOf(item.modifierGroups, o.id);
    const pos: ModPosition = grp?.allow_split ? positions[o.id] ?? "whole" : "whole";
    return { modifier_id: o.id, group_id: grp?.id ?? null, group_name: grp?.name ?? null, name: o.name, price: o.price, position: pos };
  });
  if (chosen.length > 0) {
    unit = unit + modTotal;
    label =
      label +
      " (" +
      chosen
        .map((o) => {
          const grp = groupOf(item.modifierGroups, o.id);
          const pos: ModPosition = grp?.allow_split ? positions[o.id] ?? "whole" : "whole";
          const posLabel = pos === "left" ? "½L " : pos === "right" ? "½R " : "";
          return "+ " + posLabel + o.name;
        })
        .join(", ") +
      ")";
  }
  return { name: label, unitPrice: Math.round(unit * 100) / 100, variationId: varId, modifiers };
}
