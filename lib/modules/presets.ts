// lib/modules/presets.ts
import { ModuleKey, Vocab, DEFAULT_VOCAB } from "./registry";

export type FieldType =
  | "text" | "number" | "textarea" | "date" | "datetime" | "select" | "address";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  section?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  column?: string; // if set, reads/writes this real column instead of details jsonb
};

export type Preset = {
  modules: ModuleKey[];
  vocab: Vocab;
  labels?: Partial<Record<ModuleKey, string>>;
  fields?: FieldDef[];
};

export const PRESETS: Record<string, Preset> = {
  transportation: {
    modules: ["dashboard", "jobs", "customers", "partners", "drivers", "vehicles", "profit", "settings"],
    vocab: {
      job_singular: "Trip",
      job_plural: "Trips",
      asset_singular: "Vehicle",
      asset_plural: "Vehicles",
      resource_singular: "Driver",
      resource_plural: "Drivers",
    },
    fields: [
      { key: "pickup_address", label: "Pickup address", type: "address", required: true, section: "Route", placeholder: "123 King St W, Toronto", column: "pickup_address" },
      { key: "dropoff_address", label: "Dropoff address", type: "address", required: true, section: "Route", placeholder: "Pearson Airport, Terminal 1", column: "dropoff_address" },
      { key: "passenger_count", label: "Passengers", type: "number", section: "Details", placeholder: "2", column: "passenger_count" },
      { key: "luggage_count", label: "Luggage", type: "number", section: "Details", placeholder: "3", column: "luggage_count" },
      { key: "flight_number", label: "Flight number", type: "text", section: "Details", placeholder: "AC123", column: "flight_number" },
      { key: "terminal", label: "Terminal", type: "text", section: "Details", placeholder: "Terminal 1", column: "terminal" },
    ],
  },
  restaurant: {
    modules: ["dashboard", "pos", "orders", "kitchen", "catalog", "customers", "staff", "settings"],
    vocab: DEFAULT_VOCAB,
    labels: { catalog: "Menu" },
  },
  retail: {
    modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
    vocab: DEFAULT_VOCAB,
    labels: { catalog: "Products" },
  },
  service: {
    modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
    vocab: DEFAULT_VOCAB,
    labels: { pos: "Checkout", orders: "Visits", catalog: "Services" },
  },
  mobile_seller: {
    modules: ["dashboard", "pos", "orders", "catalog", "settings"],
    vocab: DEFAULT_VOCAB,
    labels: { pos: "Sell", orders: "Sales", catalog: "Items" },
  },
};