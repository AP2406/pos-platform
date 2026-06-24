import type { PermissionKey } from "@/lib/services/permissions";

// CUST-0 typed config-key registry. Every customizable setting is declared here
// with its default, the scopes that may set it, and the permission required to
// change it at a non-user scope. Optional `legacy` reads the value from the
// current live storage (businesses columns / settings jsonb) so existing tenants
// behave EXACTLY as today until someone sets an override. Later phases add keys
// and migrate their settings cards onto this store.

export type ConfigScope = "system" | "business" | "location" | "role" | "user";
// Most-specific → least-specific (system handled in code, not the DB).
export const SCOPE_PRECEDENCE: Exclude<ConfigScope, "system">[] = ["user", "role", "location", "business"];

export type ConfigType = "boolean" | "number" | "string" | "string[]" | "number[]" | "json";

export type BusinessLike = { settings?: Record<string, unknown> | null; [k: string]: unknown };
const S = (b: BusinessLike): Record<string, unknown> => (b.settings ?? {}) as Record<string, unknown>;

export type ConfigKeyDef = {
  key: string;
  type: ConfigType;
  default: unknown;
  scopes: Exclude<ConfigScope, "system">[]; // which scopes may set an override
  editPermission: PermissionKey;             // permission for business/location/role scopes (user scope is always self)
  section: string;                           // Customization hub section
  label: string;
  description?: string;
  options?: { value: string | number | boolean; label: string }[]; // allowed values (enums)
  legacy?: (business: BusinessLike) => unknown;
};

export const HUB_SECTIONS = [
  "Business profile",
  "Modules",
  "Access & roles",
  "Notifications",
  "Workflow",
  "Layout & screens",
  "Branding",
  "Locations",
  "Templates",
] as const;

// CUST-1 approval matrix. Per sensitive action: how authorization is obtained
// when the cashier lacks the permission/cap, and the $ threshold above which it
// applies. mode 'none' = never require approval; 'pin' = manager PIN; 'async' =
// approval queue; 'either' = pin or queue. Defaults reproduce today's behavior.
export type ApprovalMode = "none" | "pin" | "async" | "either";
export type ApprovalRule = { mode: ApprovalMode; threshold: number };
export const APPROVAL_ACTIONS = ["void", "comp", "discount", "refund", "reopen", "open_drawer", "close_day", "tax_exempt", "no_sale", "edit_price"] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];
export const APPROVAL_LABELS: Record<ApprovalAction, string> = {
  void: "Void", comp: "Comp", discount: "Discount", refund: "Refund", reopen: "Reopen check",
  open_drawer: "Drawer pay-out / drop", close_day: "Close day", tax_exempt: "Tax exemption", no_sale: "No-sale", edit_price: "Edit price",
};
export const APPROVAL_DEFAULTS: Record<ApprovalAction, ApprovalRule> = {
  void: { mode: "either", threshold: 0 },
  comp: { mode: "pin", threshold: 0 },
  discount: { mode: "pin", threshold: 0 },
  refund: { mode: "pin", threshold: 0 },
  reopen: { mode: "pin", threshold: 0 },
  open_drawer: { mode: "pin", threshold: 0 },
  close_day: { mode: "pin", threshold: 0 },
  tax_exempt: { mode: "pin", threshold: 0 },
  no_sale: { mode: "none", threshold: 0 },
  edit_price: { mode: "none", threshold: 0 },
};
export const approvalKey = (a: ApprovalAction) => "approval." + a;

const APPROVAL_REGISTRY: Record<string, ConfigKeyDef> = Object.fromEntries(
  APPROVAL_ACTIONS.map((a) => [approvalKey(a), {
    key: approvalKey(a), type: "json" as const, default: APPROVAL_DEFAULTS[a],
    scopes: ["business", "location", "role"] as Exclude<ConfigScope, "system">[],
    editPermission: "manage_settings", section: "Access & roles", label: APPROVAL_LABELS[a],
  } satisfies ConfigKeyDef])
);

export const CONFIG_KEYS: Record<string, ConfigKeyDef> = {
  ...APPROVAL_REGISTRY,
  // Branding / personal — user-settable (and org/location defaults).
  "ui.theme": {
    key: "ui.theme", type: "string", default: "system", scopes: ["business", "location", "user"],
    editPermission: "manage_settings", section: "Branding", label: "Theme",
    description: "Light, dark, or follow the device.",
    options: [{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }],
  },
  "ui.language": {
    key: "ui.language", type: "string", default: "en", scopes: ["business", "location", "user"],
    editPermission: "manage_settings", section: "Branding", label: "Language",
    description: "Interface language (Quebec FR supported).",
    options: [{ value: "en", label: "English" }, { value: "fr", label: "Français" }],
  },
  // Access & roles — idle auto-logout (CUST-1 wires enforcement; default = today's 90s).
  "register.idle_logout_sec": {
    key: "register.idle_logout_sec", type: "number", default: 90, scopes: ["business", "location", "role"],
    editPermission: "manage_settings", section: "Access & roles", label: "Idle auto-logout (seconds)",
    description: "Seconds of inactivity before the register signs the cashier out.",
  },
  // Access & roles — security policy.
  "security.pin_min_len": { key: "security.pin_min_len", type: "number", default: 4, scopes: ["business", "location"], editPermission: "manage_settings", section: "Access & roles", label: "Min PIN length" },
  "security.pin_max_len": { key: "security.pin_max_len", type: "number", default: 6, scopes: ["business", "location"], editPermission: "manage_settings", section: "Access & roles", label: "Max PIN length" },
  "security.lockout_fails": { key: "security.lockout_fails", type: "number", default: 5, scopes: ["business", "location"], editPermission: "manage_settings", section: "Access & roles", label: "PIN attempts before lockout" },
  "security.lockout_sec": { key: "security.lockout_sec", type: "number", default: 60, scopes: ["business", "location"], editPermission: "manage_settings", section: "Access & roles", label: "Lockout (seconds)" },

  // Workflow — labor target % (legacy adapter proves zero-change fallback).
  "labor.target_pct": {
    key: "labor.target_pct", type: "number", default: 0, scopes: ["business", "location"],
    editPermission: "manage_settings", section: "Workflow", label: "Labor target %",
    description: "Alert when labor crosses this share of sales (0 = off).",
    legacy: (b) => { const lt = (S(b).labor_target ?? {}) as { targetPct?: unknown }; return Number(lt.targetPct) || 0; },
  },
};

// Coerce/validate a raw value to the declared type; returns null on invalid.
export function coerceConfigValue(def: ConfigKeyDef, raw: unknown): unknown {
  let v: unknown = raw;
  switch (def.type) {
    case "boolean": v = raw === true || raw === "true"; break;
    case "number": v = Number(raw); if (!Number.isFinite(v as number)) return null; break;
    case "string": v = String(raw ?? ""); break;
    case "string[]": v = Array.isArray(raw) ? raw.map(String) : null; break;
    case "number[]": v = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isFinite(n)) : null; break;
    case "json": break;
  }
  if (v === null) return null;
  if (def.options && !def.options.some((o) => o.value === v)) return null;
  return v;
}
