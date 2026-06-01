// lib/modules/resolve.ts
import { MODULES, ModuleDef, Vocab } from "./registry";
import { PRESETS, Preset, FieldDef } from "./presets";

export type NavContext = {
  industry: string | null | undefined;
  driversEnabled?: boolean;
};

export type NavItem = { key: string; href: string; label: string; icon: string };

export function getPreset(industry: string | null | undefined): Preset {
  if (industry && PRESETS[industry]) return PRESETS[industry];
  return PRESETS.transportation;
}

export function getVocab(industry: string | null | undefined): Vocab {
  return getPreset(industry).vocab;
}

export function getFields(industry: string | null | undefined): FieldDef[] {
  return getPreset(industry).fields ?? [];
}

export function resolveLabel(def: ModuleDef, preset: Preset): string {
  if (preset.labels && preset.labels[def.key]) return preset.labels[def.key] as string;
  if (def.vocabKey) {
    const word = preset.vocab[def.vocabKey];
    if (word) return word;
  }
  if (def.staticLabel) return def.staticLabel;
  return def.key;
}

export function resolveNav(ctx: NavContext): NavItem[] {
  const preset = getPreset(ctx.industry);
  const items: NavItem[] = [];
  for (const key of preset.modules) {
    if (key === "drivers" && ctx.driversEnabled === false) continue;
    const def = MODULES[key];
    if (!def) continue;
    items.push({ key: def.key, href: def.href, label: resolveLabel(def, preset), icon: def.icon });
  }
  return items;
}