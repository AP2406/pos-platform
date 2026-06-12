"use client";

import { useEffect, useState } from "react";

// P1-22: track browser connectivity so the POS can warn staff when they're
// offline (payment + firing need the network). Starts optimistic to avoid an
// SSR/first-paint flash, then syncs to the real status on mount.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}
