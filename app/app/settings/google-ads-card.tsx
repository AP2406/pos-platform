"use client";

import { useState, useEffect } from "react";
import {
  getGoogleAdsStatus,
  saveGoogleAdsAccount,
  disconnectGoogleAds,
} from "./google-ads-actions";

export function GoogleAdsCard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [loginCustomerId, setLoginCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getGoogleAdsStatus().then((s) => {
      setConnected(s.connected);
      setCustomerId(s.customerId ?? "");
      setLoginCustomerId(s.loginCustomerId ?? "");
      setLoading(false);
    });
    const p = new URLSearchParams(window.location.search).get("gads");
    if (p === "connected") setMsg("Google Ads connected.");
    else if (p === "notoken")
      setMsg("Connection failed - try again and click Allow.");
    else if (p) setMsg("Something went wrong connecting.");
  }, []);

  async function saveAccount() {
    setBusy(true);
    setMsg("");
    const res = await saveGoogleAdsAccount(customerId, loginCustomerId);
    setBusy(false);
    setMsg(res.ok ? "Saved." : "Couldn't save.");
  }

  async function disconnect() {
    setBusy(true);
    await disconnectGoogleAds();
    setBusy(false);
    setConnected(false);
    setMsg("Disconnected.");
  }

  function connect() {
    window.location.href = "/api/integrations/google-ads/connect";
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 mb-4 text-sm text-muted-foreground">
        Loading Google Ads...
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-4">
      <div className="font-semibold">Google Ads</div>
      <p className="text-sm text-muted-foreground mt-1">
        Pull your daily ad spend into your Marketing expenses automatically.
      </p>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">Customer ID</label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="1234567890"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Manager ID (optional)
            </label>
            <input
              value={loginCustomerId}
              onChange={(e) => setLoginCustomerId(e.target.value)}
              placeholder="if under a manager"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveAccount}
            disabled={busy}
            className="h-9 px-4 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-accent"
          >
            Save account
          </button>
          {connected ? (
            <>
              <span className="text-sm font-medium text-emerald-600">
                Connected
              </span>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground disabled:opacity-50 hover:bg-accent"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Connect Google Ads
            </button>
          )}
        </div>
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      </div>
    </div>
  );
}