"use client";

import { useEffect, useState } from "react";
import TokenizedChargeForm from "./form";
import { getTokenizedChargeConfig } from "./actions";

type Config = {
  applicationId: string;
  environment: string;
  merchantId: string | null;
};

export default function TokenizedChargePage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(function () {
    getTokenizedChargeConfig()
      .then(function (c) {
        setConfig(c);
      })
      .catch(function (e) {
        setErr("Could not load config: " + String(e));
      });
  }, []);

  if (err) {
    return <div style={{ padding: 24, color: "#b91c1c", fontSize: 14 }}>{err}</div>;
  }
  if (!config) {
    return <div style={{ padding: 24, color: "#666", fontSize: 14 }}>Loading...</div>;
  }

  return (
    <TokenizedChargeForm
      applicationId={config.applicationId}
      environment={config.environment}
      merchantId={config.merchantId}
    />
  );
}