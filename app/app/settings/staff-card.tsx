"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaff, updateStaff, setStaffPin, setStaffActive, setStaffPayRate, setStaffPermissionOverride } from "./staff-actions";
import { linkStaffToWebAccount, unlinkStaffWebAccount } from "./staff-link-actions";
import { ASSIGNABLE_WEB_ROLES, WEB_ROLE_LABELS, WEB_ROLE_HINTS, type WebRole } from "@/lib/services/route-access";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/lib/services/permissions";

type Staff = {
  id: string;
  name: string;
  role: string;
  role_id: string | null;
  is_active: boolean;
  has_pin: boolean;
  pay_rate: number | null;
  overrides: Record<string, boolean>;
  // 0100: the web login this PIN identity belongs to, if any.
  user_id: string | null;
  login_email: string | null;
  web_role: string | null;
};
type RolePick = { id: string; name: string; key: string | null; permissions?: string[] };

const LEGACY_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  trainee: "Trainee",
};

export function StaffCard({
  initialStaff,
  roles,
}: {
  initialStaff: Staff[];
  roles: RolePick[];
}) {
  // Owner is never assignable to a staff member.
  const assignable = roles.filter((r) => r.key !== "owner");
  const defaultRoleId =
    assignable.find((r) => r.key === "server")?.id ?? assignable[0]?.id ?? "";

  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [manageId, setManageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoleId, setEditRoleId] = useState(defaultRoleId);
  const [editPayRate, setEditPayRate] = useState("");
  const [newPin, setNewPin] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkRole, setLinkRole] = useState<WebRole>("staff");
  const [linkNote, setLinkNote] = useState<string | null>(null);

  const roleById = new Map(roles.map((r) => [r.id, r]));
  function roleGrants(s: Staff, key: string): boolean {
    const r = s.role_id ? roleById.get(s.role_id) : null;
    if (r?.key === "owner") return true;
    return !!r?.permissions?.includes(key);
  }
  function setOverride(s: Staff, key: PermissionKey, value: boolean | null) {
    setRowError(null);
    startTransition(async () => {
      const res = await setStaffPermissionOverride(s.id, key, value);
      if ("error" in res) { setRowError(res.error); return; }
      setStaff((prev) => prev.map((x) => {
        if (x.id !== s.id) return x;
        const ov = { ...x.overrides };
        if (value === null) delete ov[key]; else ov[key] = value;
        return { ...x, overrides: ov };
      }));
    });
  }

  function roleLabel(s: Staff): string {
    const r = roles.find((x) => x.id === s.role_id);
    if (r) return r.name;
    return LEGACY_ROLE_LABELS[s.role] || s.role;
  }

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!roleId) {
      setError("Choose a role.");
      return;
    }
    if (!/^[0-9]{4,6}$/.test(pin)) {
      setError("PIN must be 4 to 6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await createStaff(name.trim(), roleId, pin);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStaff((prev) => [
        ...prev,
        {
          id: res.id,
          name: name.trim(),
          role: "staff",
          role_id: roleId,
          is_active: true,
          has_pin: true,
          pay_rate: null,
          overrides: {},
          // New staff start PIN-only; dashboard access is granted per person
          // from the Manage panel.
          user_id: null,
          login_email: null,
          web_role: null,
        },
      ]);
      setName("");
      setRoleId(defaultRoleId);
      setPin("");
    });
  }

  function openManage(s: Staff) {
    setRowError(null);
    setEditName(s.name);
    setEditRoleId(s.role_id ?? defaultRoleId);
    setEditPayRate(s.pay_rate != null ? String(s.pay_rate) : "");
    setNewPin("");
    setLinkEmail("");
    setLinkRole("staff");
    setLinkNote(null);
    setManageId((prev) => (prev === s.id ? null : s.id));
  }

  function handleSaveDetails(s: Staff) {
    setRowError(null);
    if (!editName.trim()) {
      setRowError("Name is required.");
      return;
    }
    const rate = editPayRate.trim() === "" ? null : Number(editPayRate);
    startTransition(async () => {
      const res = await updateStaff(s.id, editName.trim(), editRoleId);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      const rateRes = await setStaffPayRate(s.id, rate != null && rate > 0 ? rate : null);
      if ("error" in rateRes) {
        setRowError(rateRes.error);
        return;
      }
      setStaff((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, name: editName.trim(), role_id: editRoleId, pay_rate: rate != null && rate > 0 ? rate : null }
            : x
        )
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

  function handleLink(s: Staff) {
    setRowError(null);
    setLinkNote(null);
    startTransition(async () => {
      const res = await linkStaffToWebAccount(s.id, linkEmail.trim(), linkRole);
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setStaff((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, user_id: res.userId, login_email: res.email, web_role: linkRole }
            : x
        )
      );
      setLinkNote(
        res.invited
          ? "Invitation sent to " + res.email + ". They'll set a password from that email."
          : res.email + " already had a Surge login — access granted."
      );
      setLinkEmail("");
    });
  }

  function handleUnlink(s: Staff, revokeAccess: boolean) {
    setRowError(null);
    setLinkNote(null);
    startTransition(async () => {
      const res = await unlinkStaffWebAccount(s.id, { revokeAccess });
      if ("error" in res) {
        setRowError(res.error);
        return;
      }
      setStaff((prev) =>
        prev.map((x) =>
          x.id === s.id ? { ...x, user_id: null, login_email: null, web_role: null } : x
        )
      );
      setLinkNote(
        revokeAccess ? "Unlinked and dashboard access removed." : "Unlinked. Their dashboard login still works."
      );
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Staff who operate the register. Each gets a PIN to identify themselves at
        checkout. Their role decides what they can do — edit roles under Roles &
        permissions.
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
                      {roleLabel(s)}
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
                        <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                          {assignable.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pay rate ($/hr)</Label>
                        <Input type="number" min="0" value={editPayRate} onChange={(e) => setEditPayRate(e.target.value)} placeholder="—" className="h-9 w-24" />
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

                    {/* 0100: dashboard access. A PIN identity and a web login
                        are two rows; linking them means the audit trail and
                        per-person overrides follow one person across both. */}
                    <div className="rounded-md border border-border p-2.5">
                      <p className="text-xs font-medium mb-1">Dashboard access</p>
                      {s.user_id ? (
                        <div className="space-y-1.5">
                          <p className="text-[12px] text-muted-foreground">
                            Signs in as <span className="text-foreground">{s.login_email ?? "a linked account"}</span>
                            {s.web_role ? " · " + (WEB_ROLE_LABELS[s.web_role as WebRole] ?? s.web_role) : ""}.
                            Their PIN and this login are the same person.
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleUnlink(s, false)}>
                              Unlink
                            </Button>
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleUnlink(s, true)}>
                              Unlink &amp; remove access
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[12px] text-muted-foreground">
                            {s.name} works with a PIN only. Add an email to give them the dashboard too — most kitchen and floor staff never need one.
                          </p>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="name@example.com" className="h-9 w-52" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Access level</Label>
                              <select value={linkRole} onChange={(e) => setLinkRole(e.target.value as WebRole)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                                {ASSIGNABLE_WEB_ROLES.map((r) => (
                                  <option key={r} value={r}>{WEB_ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            </div>
                            <Button size="sm" disabled={pending || !linkEmail} onClick={() => handleLink(s)}>
                              Grant access
                            </Button>
                          </div>
                          <p className="text-[12px] text-muted-foreground">{WEB_ROLE_HINTS[linkRole]}</p>
                        </div>
                      )}
                      {linkNote && <p className="text-[12px] mt-1.5 text-emerald-600 dark:text-emerald-400">{linkNote}</p>}
                    </div>

                    {/* CUST-1: per-user permission overrides */}
                    <div>
                      <button type="button" onClick={() => setShowOverrides((v) => !v)} className="text-xs text-muted-foreground underline hover:text-foreground">
                        {showOverrides ? "Hide" : "Permission overrides"}
                      </button>
                      {showOverrides && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[12px] text-muted-foreground">Grant or revoke a single permission for {s.name} without changing their role. &ldquo;Inherit&rdquo; uses the role.</p>
                          {(PERMISSION_KEYS as readonly PermissionKey[]).map((k) => {
                            const ov = s.overrides[k]; // true | false | undefined
                            const base = roleGrants(s, k);
                            const btn = (label: string, active: boolean, on: () => void, tone?: string) => (
                              <button type="button" onClick={on} disabled={pending} className={"text-[12px] rounded px-1.5 py-0.5 border " + (active ? (tone ?? "border-foreground bg-accent font-medium") : "border-border text-muted-foreground")}>{label}</button>
                            );
                            return (
                              <div key={k} className="flex items-center justify-between gap-2 py-0.5">
                                <span className="text-xs">{PERMISSION_LABELS[k]} <span className="text-[11px] text-muted-foreground">(role: {base ? "✓" : "✗"})</span></span>
                                <span className="flex gap-1 shrink-0">
                                  {btn("Inherit", ov === undefined, () => setOverride(s, k, null))}
                                  {btn("Grant", ov === true, () => setOverride(s, k, true), "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium")}
                                  {btn("Revoke", ov === false, () => setOverride(s, k, false), "border-red-500 bg-red-500/15 text-red-700 dark:text-red-400 font-medium")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
            {assignable.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
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
