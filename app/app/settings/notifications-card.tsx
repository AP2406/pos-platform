"use client";

import { useState, useEffect } from "react";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestNotification,
  setNotificationPref,
} from "./notifications-actions";

const TYPES = [
  {
    key: "new_lead",
    label: "New leads",
    desc: "When a booking email creates a new lead.",
  },
  {
    key: "trip_reminder",
    label: "Trip reminders",
    desc: "A heads-up before an upcoming pickup.",
  },
  {
    key: "payment_received",
    label: "Payments",
    desc: "When a trip is marked paid.",
  },
];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsCard({
  initialPrefs,
}: {
  initialPrefs: Record<string, boolean>;
}) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const t of TYPES) base[t.key] = initialPrefs[t.key] !== false;
    return base;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready
      .then(function (reg) {
        return reg.pushManager.getSubscription();
      })
      .then(function (sub) {
        setEnabled(!!sub);
      })
      .catch(function () {});
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Permission wasn't granted.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      if (!key) {
        setMsg(
          "Push isn't configured yet — the public key is missing from the build."
        );
        setBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      });
      const res = await savePushSubscription(JSON.stringify(sub));
      if (res.ok) {
        setEnabled(true);
        setMsg("Notifications are on for this device.");
      } else {
        setMsg("Couldn't save the subscription.");
      }
    } catch (e) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      setMsg("Couldn't turn on notifications: " + detail);
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMsg("Notifications turned off for this device.");
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMsg("");
    const res = await sendTestNotification();
    setMsg(res.message);
    setBusy(false);
  }

  async function togglePref(key: string) {
    const next = !prefs[key];
    setPrefs(function (p) {
      return { ...p, [key]: next };
    });
    await setNotificationPref(key, next);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-semibold">Notifications</div>
      <p className="text-sm text-muted-foreground mt-1">
        Turn on push for this device, then choose which alerts you want.
      </p>

      {!supported ? (
        <p className="text-sm text-muted-foreground mt-3">
          Push isn&apos;t available here. On iPhone, open Surge from your home
          screen (not Safari) and try again.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {!enabled ? (
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90"
                >
                  Enable on this device
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={disable}
                    disabled={busy}
                    className="h-9 px-4 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-accent"
                  >
                    Turn off this device
                  </button>
                  <button
                    type="button"
                    onClick={test}
                    disabled={busy}
                    className="h-9 px-4 rounded-lg bg-secondary text-foreground text-sm disabled:opacity-50 hover:opacity-90"
                  >
                    Send test
                  </button>
                </>
              )}
            </div>
            {msg ? (
              <p className="text-sm text-muted-foreground">{msg}</p>
            ) : null}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="text-sm font-medium">Alert me about</div>
            {TYPES.map(function (t) {
              return (
                <div
                  key={t.key}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[t.key]}
                    onClick={function () {
                      togglePref(t.key);
                    }}
                    className={
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                      (prefs[t.key] ? "bg-primary" : "bg-muted")
                    }
                  >
                    <span
                      className={
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform " +
                        (prefs[t.key] ? "translate-x-5" : "translate-x-0.5")
                      }
                    />
                  </button>
                </div>
              );
            })}
            {!enabled ? (
              <p className="text-xs text-muted-foreground">
                Enable this device above to actually receive these.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}