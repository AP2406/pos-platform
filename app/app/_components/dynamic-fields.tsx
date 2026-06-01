"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldDef } from "@/lib/modules/presets";

const selectClass =
  "w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (!fields || fields.length === 0) return null;

  const groups: { section: string | null; items: FieldDef[] }[] = [];
  for (const f of fields) {
    const sec = f.section ?? null;
    let g = groups.find((x) => x.section === sec);
    if (!g) {
      g = { section: sec, items: [] };
      groups.push(g);
    }
    g.items.push(f);
  }

  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-3 pt-3 border-t border-border">
          {group.section && <Label>{group.section}</Label>}
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((f) => {
              const wide = f.type === "textarea" || f.type === "address";
              return (
                <div key={f.key} className={wide ? "col-span-2 space-y-1" : "space-y-1"}>
                  <Label htmlFor={"f-" + f.key} className="text-xs text-muted-foreground">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      id={"f-" + f.key}
                      value={values[f.key] ?? ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      placeholder={f.placeholder ?? ""}
                      rows={3}
                    />
                  ) : f.type === "select" ? (
                    <select
                      id={"f-" + f.key}
                      value={values[f.key] ?? ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select...</option>
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={"f-" + f.key}
                      type={
                        f.type === "number"
                          ? "number"
                          : f.type === "date"
                          ? "date"
                          : f.type === "datetime"
                          ? "datetime-local"
                          : "text"
                      }
                      value={values[f.key] ?? ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      placeholder={f.placeholder ?? ""}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}