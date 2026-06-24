"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "@/lib/services/permissions";
import {
  updateRolePermissions,
  setRoleCaps,
  createRole,
  cloneRole,
  renameRole,
  deleteRole,
  type RoleRow,
} from "./roles-actions";

export function RolesCard({ initialRoles }: { initialRoles: RoleRow[] }) {
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<PermissionKey>>(new Set());
  const [draftCompCap, setDraftCompCap] = useState("");
  const [draftDiscountCap, setDraftDiscountCap] = useState("");
  const [draftDiscountPct, setDraftDiscountPct] = useState("");
  const [draftRefundCap, setDraftRefundCap] = useState("");
  const [draftVoidWindow, setDraftVoidWindow] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openRole(r: RoleRow) {
    setRowError(null);
    if (openId === r.id) {
      setOpenId(null);
      return;
    }
    setOpenId(r.id);
    setDraft(new Set(r.permissions as PermissionKey[]));
    setDraftCompCap(r.compCap != null ? String(r.compCap) : "");
    setDraftDiscountCap(r.discountCap != null ? String(r.discountCap) : "");
    setDraftDiscountPct(r.discountPctCap != null ? String(r.discountPctCap) : "");
    setDraftRefundCap(r.refundCap != null ? String(r.refundCap) : "");
    setDraftVoidWindow(r.voidWindowMin != null ? String(r.voidWindowMin) : "");
  }

  function toggle(p: PermissionKey) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function save(r: RoleRow) {
    setRowError(null);
    const perms = Array.from(draft);
    const num = (s: string) => { const n = s.trim() === "" ? null : Number(s); return n != null && n > 0 ? n : null; };
    const compCap = num(draftCompCap), discountCap = num(draftDiscountCap);
    const discountPctCap = num(draftDiscountPct), refundCap = num(draftRefundCap), voidWindowMin = num(draftVoidWindow);
    startTransition(async () => {
      const res = await updateRolePermissions(r.id, perms);
      if ("error" in res) { setRowError(res.error); return; }
      const capsRes = await setRoleCaps(r.id, { compCap, discountCap, discountPctCap, refundCap, voidWindowMin });
      if ("error" in capsRes) { setRowError(capsRes.error); return; }
      setRoles((prev) => prev.map((x) => (x.id === r.id ? { ...x, permissions: perms, compCap, discountCap, discountPctCap, refundCap, voidWindowMin } : x)));
      setOpenId(null);
    });
  }

  function handleClone(r: RoleRow) {
    const name = prompt("Name for the cloned role?", r.name + " copy");
    if (!name) return;
    setRowError(null);
    startTransition(async () => {
      const res = await cloneRole(r.id, name);
      if ("error" in res) { setRowError(res.error); return; }
      setRoles((prev) => [...prev, { ...r, id: res.id, name, key: null, is_system: false, sort_order: prev.length }]);
    });
  }
  function handleRename(r: RoleRow) {
    const name = prompt("Rename role", r.name);
    if (!name || name.trim() === r.name) return;
    setRowError(null);
    startTransition(async () => {
      const res = await renameRole(r.id, name);
      if ("error" in res) { setRowError(res.error); return; }
      setRoles((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: name.trim() } : x)));
    });
  }

  function handleAdd() {
    setError(null);
    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createRole(newName.trim());
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setRoles((prev) => [
        ...prev,
        {
          id: res.id, name: newName.trim(), key: null, is_system: false, permissions: [],
          compCap: null, discountCap: null, discountPctCap: null, refundCap: null, voidWindowMin: null,
          hiddenNav: [], sort_order: prev.length,
        },
      ]);
      setNewName("");
    });
  }

  function handleDelete(r: RoleRow) {
    setRowError(null);
    startTransition(async () => {
      const res = await deleteRole(r.id);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setRoles((prev) => prev.filter((x) => x.id !== r.id));
      setOpenId(null);
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        What each role can do at the register. The <strong>Owner</strong> role
        always has every permission. Assign a role to each staff member under
        Staff and PINs.
      </p>

      <div className="divide-y divide-border border border-border rounded-md mb-3">
        {roles.map((r) => {
          const open = openId === r.id;
          const isOwner = r.key === "owner";
          return (
            <div key={r.id} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{r.name}</span>
                  {r.is_system ? (
                    <span className="ml-2 text-xs text-muted-foreground">Built-in</span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">Custom</span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {isOwner ? "All permissions" : `${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {!isOwner && (
                    <button type="button" onClick={() => openRole(r)} className="text-xs text-muted-foreground underline hover:text-foreground">
                      {open ? "Close" : "Edit"}
                    </button>
                  )}
                  <button type="button" onClick={() => handleRename(r)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-foreground">Rename</button>
                  <button type="button" onClick={() => handleClone(r)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-foreground">Clone</button>
                </div>
              </div>

              {open && !isOwner && (
                <div className="mt-2 space-y-3 border-l-2 border-border pl-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {PERMISSION_KEYS.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm py-1 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={draft.has(p)}
                          onChange={() => toggle(p)}
                          className="h-4 w-4"
                        />
                        {PERMISSION_LABELS[p]}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Comp cap ($, blank = no limit)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={draftCompCap}
                        onChange={(e) => setDraftCompCap(e.target.value)}
                        placeholder="No limit"
                        className="h-9 w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount cap ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={draftDiscountCap}
                        onChange={(e) => setDraftDiscountCap(e.target.value)}
                        placeholder="No limit"
                        className="h-9 w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount cap (%)</Label>
                      <Input type="number" min="0" max="100" value={draftDiscountPct} onChange={(e) => setDraftDiscountPct(e.target.value)} placeholder="No limit" className="h-9 w-28" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Refund cap ($)</Label>
                      <Input type="number" min="0" value={draftRefundCap} onChange={(e) => setDraftRefundCap(e.target.value)} placeholder="No limit" className="h-9 w-28" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Void window (min)</Label>
                      <Input type="number" min="0" value={draftVoidWindow} onChange={(e) => setDraftVoidWindow(e.target.value)} placeholder="Any time" className="h-9 w-28" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A comp/discount/refund over its cap (or a void past the window) requires approval. Blank = no limit. Approval routing is configured in Customization → Access &amp; roles.
                  </p>
                  {rowError && <p className="text-sm text-red-600">{rowError}</p>}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => save(r)} disabled={pending}>
                      {pending ? "Saving..." : "Save"}
                    </Button>
                    {!r.is_system && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(r)}
                        disabled={pending}
                      >
                        Delete role
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">New role</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Bartender"
            className="h-9 w-44"
          />
        </div>
        <Button variant="outline" onClick={handleAdd} disabled={pending || !newName.trim()}>
          Add role
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
