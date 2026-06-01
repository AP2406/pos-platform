// lib/modules/config.ts
import { MODULES, DEFAULT_VOCAB, Vocab, ModuleKey } from "./registry";
import { Preset, FieldDef, FieldType } from "./presets";

const VALID_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

// Keep in sync with FieldType in presets.ts
const VALID_FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "textarea",
  "date",
  "datetime",
  "select",
  "address",
];

const MAX_MODULES = 24;
const MAX_FIELDS = 30;
const MAX_OPTIONS = 40;
const MAX_LABEL = 60;
const MAX_VOCAB = 40;
const MAX_PLACEHOLDER = 120;
const MAX_SECTION = 40;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

const VOCAB_KEYS: (keyof Vocab)[] = [
  "job_singular",
  "job_plural",
  "asset_singular",
  "asset_plural",
  "resource_singular",
  "resource_plural",
];

function sanitizeVocab(raw: unknown): Vocab {
  const out: Vocab = { ...DEFAULT_VOCAB };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const k of VOCAB_KEYS) {
      const v = str(r[k], MAX_VOCAB);
      if (v) out[k] = v;
    }
  }
  return out;
}

function sanitizeField(raw: unknown): FieldDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const key = str(r.key, 60);
  const label = str(r.label, MAX_LABEL);
  const type = r.type;
  if (!key || !label) return null;
  if (typeof type !== "string" || !VALID_FIELD_TYPES.includes(type as FieldType)) {
    return null;
  }

  // key must be a safe slug (letters, numbers, underscore only)
  const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60);
  if (!safeKey) return null;

  const field: FieldDef = {
    key: safeKey,
    label,
    type: type as FieldType,
  };

  const section = str(r.section, MAX_SECTION);
  if (section) field.section = section;

  if (r.required === true) field.required = true;

  const placeholder = str(r.placeholder, MAX_PLACEHOLDER);
  if (placeholder) field.placeholder = placeholder;

  if (field.type === "select" && Array.isArray(r.options)) {
    const options = r.options
      .map((o) => str(o, MAX_LABEL))
      .filter((o): o is string => !!o)
      .slice(0, MAX_OPTIONS);
    if (options.length) field.options = options;
  }

  // NOTE: `column` is intentionally NOT copied. Config-driven fields can never
  // map to a real DB column; they always persist into the `details` jsonb.
  // This is what stops generated config from ever touching arbitrary columns.

  return field;
}

export function validateConfig(raw: unknown): Preset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.modules)) return null;
  const seen = new Set<string>();
  const modules: ModuleKey[] = [];
  for (const m of r.modules) {
    if (typeof m !== "string") continue;
    if (!VALID_MODULE_KEYS.includes(m as ModuleKey)) continue;
    if (seen.has(m)) continue;
    seen.add(m);
    modules.push(m as ModuleKey);
    if (modules.length >= MAX_MODULES) break;
  }
  if (modules.length === 0) return null;

  // Never let a config lock the owner out of the basics.
  if (!modules.includes("dashboard" as ModuleKey)) {
    modules.unshift("dashboard" as ModuleKey);
  }
  if (!modules.includes("settings" as ModuleKey)) {
    modules.push("settings" as ModuleKey);
  }

  const vocab = sanitizeVocab(r.vocab);
  const preset: Preset = { modules, vocab };

  if (r.labels && typeof r.labels === "object") {
    const labels: Partial<Record<ModuleKey, string>> = {};
    const lr = r.labels as Record<string, unknown>;
    for (const k of Object.keys(lr)) {
      if (!VALID_MODULE_KEYS.includes(k as ModuleKey)) continue;
      const v = str(lr[k], MAX_LABEL);
      if (v) labels[k as ModuleKey] = v;
    }
    if (Object.keys(labels).length) preset.labels = labels;
  }

  if (Array.isArray(r.fields)) {
    const fields: FieldDef[] = [];
    for (const f of r.fields) {
      const sf = sanitizeField(f);
      if (sf) fields.push(sf);
      if (fields.length >= MAX_FIELDS) break;
    }
    if (fields.length) preset.fields = fields;
  }

  return preset;
}