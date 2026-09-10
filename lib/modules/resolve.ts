// lib/modules/resolve.ts
import { MODULES, ModuleDef, ModuleKey, Vocab } from "./registry";
import { PRESETS, Preset, FieldDef } from "./presets";
import { validateConfig } from "./config";

export type BusinessConfigInput = {
  industry?: string | null;
  config?: unknown;
};

type ResolveArg = string | null | undefined | BusinessConfigInput;

export type ModuleContext = {
  industry?: string | null;
  config?: unknown;
  /** Mirrors businesses.drivers_enabled — the driver roster's opt-out. */
  driversEnabled?: boolean | null;
};

export type NavContext = ModuleContext;

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

/**
 * The modules this business actually runs, in preset order.
 *
 * One list with three consumers — resolveNav(), buildNav() and the page guards
 * in lib/modules/access.ts — so the sidebar can't offer a route the guard would
 * bounce, or hide one it would allow. Two things drop out of the raw preset:
 *
 *   - drivers, when the business switched the roster off in settings.
 *   - anything flagged `unbuilt` in the registry, so a stored config can never
 *     point a tenant's sidebar at a route that doesn't exist.
 */
export function enabledModules(ctx: ModuleContext): ModuleKey[] {
  const preset = getPreset({ industry: ctx.industry, config: ctx.config });
  return preset.modules.filter((key) => {
    if (key === "drivers" && ctx.driversEnabled === false) return false;
    const def = MODULES[key];
    return def != null && def.unbuilt !== true;
  });
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
  // enabledModules() owns "which modules is this business actually running",
  // so the menu and the page guards in lib/modules/access.ts can't drift apart.
  for (const key of enabledModules(ctx)) {
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