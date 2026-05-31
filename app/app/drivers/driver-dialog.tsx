"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDriver, updateDriver, deleteDriver } from "./actions";

type Driver = {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  license_number?: string | null;
  status?: string | null;
  notes?: string | null;
};

export function DriverDialog({
  mode,
  driver,
  redirectOnDelete,
}: {
  mode: "create" | "edit";
  driver?: Driver;
  redirectOnDelete?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [email, setEmail] = useState(driver?.email ?? "");
  const [license, setLicense] = useState(driver?.license_number ?? "");
  const [status, setStatus] = useState(
    driver?.status === "inactive" ? "inactive" : "active"
  );
  const [notes, setNotes] = useState(driver?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    if (mode === "create") {
      setName("");
      setPhone("");
      setEmail("");
      setLicense("");
      setStatus("active");
      setNotes("");
    }
    setError(null);
  }

  async function save() {
    setError(null);
    setSaving(true);
    const input = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      license_number: license.trim(),
      status: status as "active" | "inactive",
      notes: notes.trim(),
    };
    const res =
      mode === "create"
        ? await createDriver(input)
        : await updateDriver(driver!.id as string, input);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      setOpen(false);
      reset();
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Delete this driver? This cannot be undone.")) return;
    setSaving(true);
    const res = await deleteDriver(driver!.id as string);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      setOpen(false);
      if (redirectOnDelete) {
        router.push(redirectOnDelete);
      } else {
        router.refresh();
      }
    }
  }

  const triggerClass =
    mode === "create"
      ? "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
      : "inline-flex items-center justify-center h-8 px-3 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={triggerClass}
      >
        {mode === "create" ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add driver
          </>
        ) : (
          "Edit"
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6">
            <h2 className="text-lg font-semibold tracking-tight">
              {mode === "create" ? "Add driver" : "Edit driver"}
            </h2>

            <div className="mt-5 space-y-4">
              <Field label="Name" value={name} onChange={setName} placeholder="Driver full name" autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={phone} onChange={setPhone} placeholder="(416) 555-0199" />
                <Field label="Email" value={email} onChange={setEmail} placeholder="driver@email.com" />
              </div>
              <Field label="License #" value={license} onChange={setLicense} placeholder="Optional" />

              <div>
                <label className="text-sm font-medium">Status</label>
                <div className="mt-2 flex gap-2">
                  {["active", "inactive"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={
                        "flex-1 h-10 rounded-lg border text-sm font-medium capitalize transition-colors " +
                        (status === s
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-accent")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="mt-2 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <div>
                {mode === "edit" && (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={saving}
                    className="text-sm text-destructive hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving && (
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {mode === "create" ? "Add driver" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mt-2 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}