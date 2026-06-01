// lib/modules/resolve.ts
import { MODULES, ModuleDef, Vocab } from "./registry";
import { PRESETS, Preset, FieldDef } from "./presets";
import { validateConfig } from "./config";

export type BusinessConfigInput = {
  industry?: string | null;
  config?: unknown;
};

type ResolveArg = string | null | undefined | BusinessConfigInput;

export type NavContext = {
  industry?: string | null;
  config?: unknown;
  driversEnabled?: boolean;
};

export type NavItem = { key: string; href: string; label: string; icon: string };

function normalize(arg: ResolveArg): BusinessConfigInput {
  if (arg == null) return {};
  if (typeof arg === "string") return { industry: arg };
  return arg;
}

export function getPreset(arg: ResolveArg): Preset {
  const b = normalize(arg);
  const fromConfig = validateConfig(b.config);
  if (fromConfig) return fromConfig;
  if (b.industry && PRESETS[b.industry]) return PRESETS[b.industry];
  return PRESETS.transportation;
}

export function getVocab(arg: ResolveArg): Vocab {
  return getPreset(arg).vocab;
}

export function getFields(arg: ResolveArg): FieldDef[] {
  return getPreset(arg).fields ?? [];
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
  const preset = getPreset({ industry: ctx.industry, config: ctx.config });
  const items: NavItem[] = [];
  for (const key of preset.modules) {
    if (key === "drivers" && ctx.driversEnabled === false) continue;
    const def = MODULES[key];
    if (!def) continue;
    items.push({
      key: def.key,
      href: def.href,
      label: resolveLabel(def, preset),
      icon: def.icon,
    });
  }
  return items;
}