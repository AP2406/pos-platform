"use client";

import { useEffect, useState } from "react";

// Connectivity for the POS (payment + firing need the network). We deliberately
// do NOT trust `navigator.onLine` — it has frequent FALSE NEGATIVES (reports
// offline on a perfectly connected machine), which used to stick the orange
// "you're offline" banner and block Fire/Charge. Instead: start optimistic,
// treat the browser online/offline events only as a trigger to RE-CHECK, and
// decide offline solely from an actual heartbeat fetch that fails. A successful
// fetch self-heals a stuck banner within the interval.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;

    const ping = async () => {
      try {
        const res = await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
        if (alive && res.ok) setOnline(true); // a real round-trip proves we're online
      } catch {
        if (alive) setOnline(false); // only the network actually failing marks us offline
      }
    };

    const goOnline = () => setOnline(true);
    const goOffline = () => ping(); // verify via heartbeat — never trust the event alone
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    ping();
    const id = setInterval(ping, 30000);

    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
