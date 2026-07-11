// lib/modules/registry.ts
// Catalog of every module the platform can show. Presets pick which pieces a business gets.

export type ModuleKey =
  | "dashboard" | "jobs" | "customers" | "partners" | "drivers" | "vehicles"
  | "profit" | "leads" | "calendar" | "invoices" | "proposals"
  | "pos" | "orders" | "kitchen" | "catalog" | "staff" | "settings";

export type Vocab = {
  job_singular: string;
  job_plural: string;
  asset_singular: string;
  asset_plural: string;
  resource_singular: string;
  resource_plural: string;
};

export const DEFAULT_VOCAB: Vocab = {
  job_singular: "Job",
  job_plural: "Jobs",
  asset_singular: "Asset",
  asset_plural: "Assets",
  resource_singular: "Team member",
  resource_plural: "Team",
};

export type ModuleDef = {
  key: ModuleKey;
  href: string;
  staticLabel?: string;
  vocabKey?: keyof Vocab;
  icon: string;
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  dashboard: { key: "dashboard", href: "/app", staticLabel: "Dashboard", icon: "home" },
  jobs: { key: "jobs", href: "/app/trips", vocabKey: "job_plural", icon: "route" },
  customers: { key: "customers", href: "/app/customers", staticLabel: "Customers", icon: "users" },
  partners: { key: "partners", href: "/app/partners", staticLabel: "Partners", icon: "handshake" },
  drivers: { key: "drivers", href: "/app/drivers", vocabKey: "resource_plural", icon: "badge" },
  vehicles: { key: "vehicles", href: "/app/vehicles", vocabKey: "asset_plural", icon: "car" },
  profit: { key: "profit", href: "/app/profit", staticLabel: "Profit", icon: "chart" },
  leads: { key: "leads", href: "/app/leads", staticLabel: "Leads", icon: "inbox" },
  calendar: { key: "calendar", href: "/app/calendar", staticLabel: "Calendar", icon: "calendar" },
  invoices: { key: "invoices", href: "/app/invoices", staticLabel: "Invoices", icon: "receipt" },
  proposals: { key: "proposals", href: "/app/proposals", staticLabel: "Proposals", icon: "doc" },
  pos: { key: "pos", href: "/app/pos", staticLabel: "POS", icon: "cash" },
  // Orders = the fulfillment hub (/app/orders, channel-segmented). Settled-payment
  // history lives at /app/pos/sales, linked from the hub header.
  orders: { key: "orders", href: "/app/orders", staticLabel: "Orders", icon: "list" },
  kitchen: { key: "kitchen", href: "/app/kitchen", staticLabel: "Kitchen", icon: "list" },
  catalog: { key: "catalog", href: "/app/catalog", staticLabel: "Catalog", icon: "grid" },
  staff: { key: "staff", href: "/app/staff", staticLabel: "Staff", icon: "users" },
  settings: { key: "settings", href: "/app/settings", staticLabel: "Settings", icon: "settings" },
};