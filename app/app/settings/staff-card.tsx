"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaff, updateStaff, setStaffPin, setStaffActive } from "./staff-actions";

type Staff = { id: string; name: string; role: string; is_active: boolean; has_pin: boolean };

const ROLE_LABELS: Record<string, string> = { manager: "Manager", staff: "Staff", trainee: "Trainee" };

export function StaffCard({ initialStaff }: { initialStaff: Staff[] }) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [manageId, setManageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [newPin, setNewPin] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!/^[0-9]{4,6}$/.test(pin)) {
      setError("PIN must be 4 to 6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await createStaff(name.trim(), role, pin);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStaff((prev) => [
        ...prev,
        { id: res.id, name: name.trim(), role: role, is_active: true, has_pin: true },
      ]);
      setName("");
      setRole("staff");
      setPin("");
    });
  }

  function openManage(s: Staff) {
    setRowError(null);
    setEditName(s.name);
    setEditRole(s.role);
    setNewPin("");
    setManageId((prev) => (prev === s.id ? null : s.id));
  }

  function handleSaveDetails(s: Staff) {
    setRowError(null);
    if (!editName.trim()) {
      setRowError("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await updateStaff(s.id, editName.trim(), editRole);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setStaff((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, name: editName.trim(), role: editRole } : x))
      );
    });
  }

  function handleResetPin(s: Staff) {
    setRowError(null);
    if (!/^[0-9]{4,6}$/.test(newPin)) {
      setRowError("PIN must be 4 to 6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await setStaffPin(s.id, newPin);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, has_pin: true } : x)));
      setNewPin("");
    });
  }

  function handleToggleActive(s: Staff) {
    startTransition(async () => {
      const res = await setStaffActive(s.id, !s.is_active);
      if (!("error" in res)) {
        setStaff((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x))
        );
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Staff who operate the register. Each gets a PIN to identify themselves at
        checkout. Managers can approve actions like voids and refunds.
      </p>

      {staff.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md mb-3">
          {staff.map((s) => {
            const open = manageId === s.id;
            return (
              <div key={s.id} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className={"font-medium " + (s.is_active ? "" : "text-muted-foreground line-through")}>
                      {s.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                    {!s.has_pin && <span className="ml-2 text-xs text-amber-500">No PIN</span>}
                  </div>
                  <button type="button" onClick={() => openManage(s)} className="text-xs text-muted-foreground underline hover:text-foreground">
                    {open ? "Close" : "Manage"}
                  </button>
                </div>
                {open && (
                  <div className="mt-2 space-y-3 border-l-2 border-border pl-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 w-40" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Role</Label>
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                          <option value="trainee">Trainee</option>
                        </select>
                      </div>
                      <Button size="sm" onClick={() => handleSaveDetails(s)} disabled={pending}>
                        Save
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Reset PIN</Label>
                        <Input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="4-6 digits" className="h-9 w-32" />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleResetPin(s)} disabled={pending || !newPin}>
                        Set PIN
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(s)} disabled={pending}>
                        {s.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                    {rowError && <p className="text-sm text-red-600">{rowError}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="trainee">Trainee</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">PIN (4-6 digits)</Label>
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="0000" className="h-9 w-32" />
        </div>
        <Button onClick={handleAdd} disabled={pending || !name.trim()}>
          {pending ? "Saving..." : "Add staff"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}