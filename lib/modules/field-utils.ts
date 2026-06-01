// lib/modules/field-utils.ts
import { FieldDef } from "./presets";

// Read a field's value from a job row (real column or details jsonb).
export function readFieldValue(
  row: Record<string, unknown> | null | undefined,
  field: FieldDef
): unknown {
  if (!row) return undefined;
  if (field.column) return row[field.column];
  const details = (row.details ?? {}) as Record<string, unknown>;
  return details[field.key];
}

// Build a flat string map of form values from a row (empty for a new job).
export function initialFieldValues(
  row: Record<string, unknown> | null | undefined,
  fields: FieldDef[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = readFieldValue(row, f);
    out[f.key] = v == null ? "" : String(v);
  }
  return out;
}

// Split submitted values into real-column updates and a details jsonb object.
export function splitForSave(
  values: Record<string, string>,
  fields: FieldDef[]
): { columns: Record<string, unknown>; details: Record<string, unknown> } {
  const columns: Record<string, unknown> = {};
  const details: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (raw === undefined) continue;
    let val: unknown;
    if (raw === "") {
      val = null;
    } else if (f.type === "number") {
      const n = Number(raw);
      val = isNaN(n) ? null : n;
    } else {
      val = raw;
    }
    if (f.column) columns[f.column] = val;
    else details[f.key] = val;
  }
  return { columns, details };
}