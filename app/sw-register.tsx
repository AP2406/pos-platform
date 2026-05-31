"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(function (e) {
        console.error("SW register failed:", e);
      });
    }
  }, []);
  return null;
}