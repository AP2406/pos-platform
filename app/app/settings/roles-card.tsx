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
  createRole,
  deleteRole,
  type RoleRow,
} from "./roles-actions";

export function RolesCard({ initialRoles }: { initialRoles: RoleRow[] }) {
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<PermissionKey>>(new Set());
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
    startTransition(async () => {
      const res = await updateRolePermissions(r.id, perms);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setRoles((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, permissions: perms } : x))
      );
      setOpenId(null);
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
          id: res.id,
          name: newName.trim(),
          key: null,
          is_system: false,
          permissions: [],
          sort_order: prev.length,
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
                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => openRole(r)}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {open ? "Close" : "Edit"}
                  </button>
                )}
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
