"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createVendor,
  updateVendor,
  deleteVendor,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  sendPurchaseOrder,
  type POLineInput,
} from "./actions";

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
};
type Line = {
  id?: string;
  ingredient_id: string | null;
  catalog_item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  received_qty?: number;
};
type Order = {
  id: string;
  vendor_id: string | null;
  po_number: number;
  status: string;
  notes: string | null;
  expected_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  lines: Line[];
};
type Ingredient = { id: string; name: string; unit: string; cost: number };
type Item = { id: string; name: string };

type DraftLine = Line & { key: string };

export function PurchasingClient({
  vendors: initialVendors,
  orders: initialOrders,
  ingredients,
  items,
  currency,
  canManage,
}: {
  vendors: Vendor[];
  orders: Order[];
  ingredients: Ingredient[];
  items: Item[];
  currency: string;
  canManage: boolean;
}) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [building, setBuilding] = useState<null | { editId?: string }>(null);

  const fmt = useMemo(
    () => (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n),
    [currency]
  );
  const vendorName = (id: string | null) =>
    id ? vendors.find((v) => v.id === id)?.name ?? "Unknown vendor" : "No vendor";

  return (
    <div className="space-y-6 max-w-3xl">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <VendorsManager
        vendors={vendors}
        setVendors={setVendors}
        canManage={canManage}
        pending={pending}
        startTransition={startTransition}
        setErr={setErr}
      />

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium">Purchase orders ({orders.length})</h2>
            <p className="text-xs text-muted-foreground">Raise, send, and track orders.</p>
          </div>
          {canManage && !building && (
            <Button size="sm" onClick={() => { setErr(null); setMsg(null); setBuilding({}); }}>
              New order
            </Button>
          )}
        </div>

        {building && (
          <POBuilder
            editOrder={building.editId ? orders.find((o) => o.id === building.editId) ?? null : null}
            vendors={vendors}
            ingredients={ingredients}
            items={items}
            fmt={fmt}
            pending={pending}
            startTransition={startTransition}
            setErr={setErr}
            onClose={() => setBuilding(null)}
            onSaved={(order) => {
              setOrders((prev) => {
                const without = prev.filter((o) => o.id !== order.id);
                return [order, ...without].sort((a, b) => b.po_number - a.po_number);
              });
              setBuilding(null);
              setMsg("Order saved.");
            }}
          />
        )}

        {orders.length === 0 && !building ? (
          <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((po) => {
              const total = po.lines.reduce((s, l) => s + l.unit_cost * l.quantity, 0);
              return (
                <div key={po.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        PO #{String(po.po_number).padStart(4, "0")}
                        <StatusBadge status={po.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {vendorName(po.vendor_id)} {"·"} {po.lines.length}{" "}
                        {po.lines.length === 1 ? "line" : "lines"} {"·"} {fmt(total)}
                        {po.expected_at ? ` · needed ${po.expected_at}` : ""}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        {po.status === "draft" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setErr(null); setMsg(null); setBuilding({ editId: po.id }); }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                setErr(null);
                                setMsg(null);
                                startTransition(async () => {
                                  const res = await sendPurchaseOrder(po.id);
                                  if ("error" in res) { setErr(res.error); return; }
                                  setOrders((prev) =>
                                    prev.map((o) => (o.id === po.id ? { ...o, status: "sent" } : o))
                                  );
                                  setMsg(res.emailed ? "Order sent and emailed to the vendor." : "Order marked as sent.");
                                });
                              }}
                            >
                              Send
                            </Button>
                          </>
                        )}
                        {po.status !== "received" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            disabled={pending}
                            onClick={() => {
                              setErr(null);
                              setMsg(null);
                              startTransition(async () => {
                                const res = await deletePurchaseOrder(po.id);
                                if ("error" in res) { setErr(res.error); return; }
                                setOrders((prev) => prev.filter((o) => o.id !== po.id));
                              });
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {po.lines.length > 0 && (
                    <div className="mt-2 border-l-2 border-border pl-3 text-xs text-muted-foreground space-y-0.5">
                      {po.lines.map((l, i) => (
                        <div key={l.id ?? i} className="flex justify-between gap-3">
                          <span className="truncate">
                            {l.description} {"·"} {l.quantity} {l.unit}
                          </span>
                          <span className="tabular-nums">{fmt(l.unit_cost * l.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-700",
    received: "bg-green-100 text-green-700",
    cancelled: "bg-muted text-muted-foreground line-through",
  };
  return (
    <span className={"ml-2 align-middle text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full " + (map[status] ?? map.draft)}>
      {status}
    </span>
  );
}

/* --------------------------------- Vendors --------------------------------- */

function VendorsManager({
  vendors,
  setVendors,
  canManage,
  pending,
  startTransition,
  setErr,
}: {
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  canManage: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  function add() {
    setErr(null);
    if (name.trim().length < 1) { setErr("Enter a vendor name."); return; }
    startTransition(async () => {
      const res = await createVendor({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      if ("error" in res) { setErr(res.error); return; }
      setVendors((prev) =>
        [...prev, { id: res.id, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, notes: null, is_active: true }]
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setName(""); setEmail(""); setPhone("");
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-sm font-medium mb-1">Vendors ({vendors.length})</h2>
      <p className="text-xs text-muted-foreground mb-4">Suppliers you raise purchase orders with.</p>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sysco" className="h-9 w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@vendor.com" className="h-9 w-52" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" className="h-9 w-36" />
          </div>
          <Button size="sm" onClick={add} disabled={pending}>Add</Button>
        </div>
      )}

      {vendors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No vendors yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {vendors.map((v) => (
            <div key={v.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{v.name}</span>
                  {v.email && <span className="text-xs text-muted-foreground ml-2">{v.email}</span>}
                  {v.phone && <span className="text-xs text-muted-foreground ml-2">{v.phone}</span>}
                </div>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setEditId((p) => (p === v.id ? null : v.id))}>
                    {editId === v.id ? "Close" : "Edit"}
                  </Button>
                )}
              </div>
              {editId === v.id && (
                <VendorEditor
                  vendor={v}
                  setVendors={setVendors}
                  pending={pending}
                  startTransition={startTransition}
                  setErr={setErr}
                  onDone={() => setEditId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorEditor({
  vendor,
  setVendors,
  pending,
  startTransition,
  setErr,
  onDone,
}: {
  vendor: Vendor;
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(vendor.name);
  const [email, setEmail] = useState(vendor.email ?? "");
  const [phone, setPhone] = useState(vendor.phone ?? "");

  return (
    <div className="mt-3 border-l-2 border-border pl-3 flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-44" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 w-52" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 w-36" />
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await updateVendor(vendor.id, { name: name.trim(), email, phone });
            if ("error" in res) { setErr(res.error); return; }
            setVendors((prev) =>
              prev.map((x) => (x.id === vendor.id ? { ...x, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null } : x))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            onDone();
          });
        }}
      >
        Save
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await deleteVendor(vendor.id);
            if ("error" in res) { setErr(res.error); return; }
            setVendors((prev) => prev.filter((x) => x.id !== vendor.id));
            onDone();
          });
        }}
      >
        Delete
      </Button>
    </div>
  );
}

/* ------------------------------- PO builder ------------------------------- */

let keySeq = 0;
function newKey(): string {
  keySeq += 1;
  return "k" + keySeq;
}

function POBuilder({
  editOrder,
  vendors,
  ingredients,
  items,
  fmt,
  pending,
  startTransition,
  setErr,
  onClose,
  onSaved,
}: {
  editOrder: Order | null;
  vendors: Vendor[];
  ingredients: Ingredient[];
  items: Item[];
  fmt: (n: number) => string;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  onClose: () => void;
  onSaved: (order: Order) => void;
}) {
  const [vendorId, setVendorId] = useState<string>(editOrder?.vendor_id ?? "");
  const [expected, setExpected] = useState<string>(editOrder?.expected_at ?? "");
  const [notes, setNotes] = useState<string>(editOrder?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    (editOrder?.lines ?? []).map((l) => ({ ...l, key: newKey() }))
  );

  const total = lines.reduce((s, l) => s + l.unit_cost * l.quantity, 0);

  function addIngredient(id: string) {
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    setLines((p) => [
      ...p,
      { key: newKey(), ingredient_id: ing.id, catalog_item_id: null, description: ing.name, unit: ing.unit, quantity: 1, unit_cost: ing.cost },
    ]);
  }
  function addItem(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setLines((p) => [
      ...p,
      { key: newKey(), ingredient_id: null, catalog_item_id: it.id, description: it.name, unit: "unit", quantity: 1, unit_cost: 0 },
    ]);
  }
  function addBlank() {
    setLines((p) => [
      ...p,
      { key: newKey(), ingredient_id: null, catalog_item_id: null, description: "", unit: "unit", quantity: 1, unit_cost: 0 },
    ]);
  }
  function patch(key: string, fields: Partial<DraftLine>) {
    setLines((p) => p.map((l) => (l.key === key ? { ...l, ...fields } : l)));
  }
  function removeLine(key: string) {
    setLines((p) => p.filter((l) => l.key !== key));
  }

  function save() {
    setErr(null);
    const payloadLines: POLineInput[] = lines.map((l) => ({
      ingredient_id: l.ingredient_id,
      catalog_item_id: l.catalog_item_id,
      description: l.description,
      unit: l.unit,
      quantity: Number(l.quantity) || 0,
      unit_cost: Number(l.unit_cost) || 0,
    }));
    startTransition(async () => {
      if (editOrder) {
        const res = await updatePurchaseOrder(editOrder.id, {
          vendor_id: vendorId || null,
          notes,
          expected_at: expected || null,
          lines: payloadLines,
        });
        if ("error" in res) { setErr(res.error); return; }
        onSaved({
          ...editOrder,
          vendor_id: vendorId || null,
          notes: notes || null,
          expected_at: expected || null,
          lines: lines.map((l) => ({ ...l })),
        });
      } else {
        const res = await createPurchaseOrder({
          vendor_id: vendorId || null,
          notes,
          expected_at: expected || null,
          lines: payloadLines,
        });
        if ("error" in res) { setErr(res.error); return; }
        onSaved({
          id: res.id,
          vendor_id: vendorId || null,
          po_number: 0, // server assigns; list re-sorts on next load
          status: "draft",
          notes: notes || null,
          expected_at: expected || null,
          sent_at: null,
          received_at: null,
          lines: lines.map((l) => ({ ...l })),
        });
      }
    });
  }

  const usedIng = new Set(lines.map((l) => l.ingredient_id).filter(Boolean));
  const availIng = ingredients.filter((i) => !usedIng.has(i.id));

  return (
    <div className="mb-4 border border-border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{editOrder ? `Edit PO #${String(editOrder.po_number).padStart(4, "0")}` : "New purchase order"}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Vendor</Label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm w-48"
          >
            <option value="">No vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Needed by</Label>
          <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      {lines.length > 0 && (
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Item</Label>
                <Input
                  value={l.description}
                  onChange={(e) => patch(l.key, { description: e.target.value })}
                  placeholder="Description"
                  className="h-9 w-48"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={String(l.quantity)}
                  onChange={(e) => patch(l.key, { quantity: parseFloat(e.target.value) || 0 })}
                  className="h-9 w-20 text-right"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  value={l.unit}
                  onChange={(e) => patch(l.key, { unit: e.target.value })}
                  className="h-9 w-20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit cost</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={String(l.unit_cost)}
                  onChange={(e) => patch(l.key, { unit_cost: parseFloat(e.target.value) || 0 })}
                  className="h-9 w-24 text-right"
                />
              </div>
              <span className="text-xs text-muted-foreground w-20 pb-2 text-right tabular-nums">
                {fmt(l.unit_cost * l.quantity)}
              </span>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => removeLine(l.key)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {availIng.length > 0 && (
          <select
            value=""
            onChange={(e) => { addIngredient(e.target.value); e.currentTarget.value = ""; }}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">+ Ingredient…</option>
            {availIng.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({fmt(i.cost)}/{i.unit})</option>
            ))}
          </select>
        )}
        {items.length > 0 && (
          <select
            value=""
            onChange={(e) => { addItem(e.target.value); e.currentTarget.value = ""; }}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">+ Menu item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        )}
        <Button variant="outline" size="sm" onClick={addBlank}>+ Blank line</Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional note to the vendor"
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="text-sm">Total <span className="font-medium">{fmt(total)}</span></div>
        <Button size="sm" onClick={save} disabled={pending || lines.length === 0}>
          {editOrder ? "Save order" : "Create order"}
        </Button>
      </div>
    </div>
  );
}
