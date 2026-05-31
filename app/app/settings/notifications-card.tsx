"use client";

import { useState, useEffect } from "react";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestNotification,
} from "./notifications-actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsCard() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
      setMsg("Something went wrong turning on notifications.");
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-semibold">Notifications</div>
      <p className="text-sm text-muted-foreground mt-1">
        Get push alerts on this device for new leads and upcoming trips.
      </p>

      {!supported ? (
        <p className="text-sm text-muted-foreground mt-3">
          Push isn&apos;t available here. On iPhone, open Surge from your home
          screen (not Safari) and try again.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {!enabled ? (
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90"
              >
                Enable notifications
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={disable}
                  disabled={busy}
                  className="h-9 px-4 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-accent"
                >
                  Turn off
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
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
        </div>
      )}
    </div>
  );
}