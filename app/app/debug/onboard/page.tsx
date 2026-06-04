"use client";

import { useState } from "react";
import { onboardCurrentBusiness } from "../finix-onboard-actions";

type FieldState = {
  businessName: string;
  doingBusinessAs: string;
  businessType: string;
  businessDescription: string;
  businessPhone: string;
  businessTaxId: string;
  mcc: string;
  defaultStatementDescriptor: string;
  bizLine1: string;
  bizCity: string;
  bizRegion: string;
  bizPostal: string;
  bizCountry: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerTitle: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerTaxId: string;
  perLine1: string;
  perCity: string;
  perRegion: string;
  perPostal: string;
  perCountry: string;
  principalPercentageOwnership: string;
};

const DEFAULTS: FieldState = {
  businessName: "Pearson Limo Toronto",
  doingBusinessAs: "Pearson Limo Toronto",
  businessType: "INDIVIDUAL_SOLE_PROPRIETORSHIP",
  businessDescription: "Airport limousine and private car transfer service",
  businessPhone: "4160000000",
  businessTaxId: "123456789",
  mcc: "4121",
  defaultStatementDescriptor: "PEARSON LIMO",
  bizLine1: "100 King St W",
  bizCity: "Toronto",
  bizRegion: "ON",
  bizPostal: "M5X1A9",
  bizCountry: "CAN",
  ownerFirstName: "Aathi",
  ownerLastName: "Panchalingam",
  ownerTitle: "Owner",
  ownerEmail: "owner@pearsonlimo.example",
  ownerPhone: "4160000000",
  ownerTaxId: "000000000",
  perLine1: "100 King St W",
  perCity: "Toronto",
  perRegion: "ON",
  perPostal: "M5X1A9",
  perCountry: "CAN",
  principalPercentageOwnership: "100",
};

type OnboardResult =
  | { ok: true; identityId: string; merchantId: string; state: string }
  | { error: string; details?: unknown };

export default function FinixOnboardPage() {
  const [f, setF] = useState<FieldState>(DEFAULTS);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<OnboardResult | null>(null);

  const set = (k: keyof FieldState) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await onboardCurrentBusiness({
        businessName: f.businessName,
        doingBusinessAs: f.doingBusinessAs || undefined,
        businessType: f.businessType as never,
        businessPhone: f.businessPhone,
        businessTaxId: f.businessTaxId || undefined,
        businessAddress: {
          line1: f.bizLine1,
          city: f.bizCity,
          region: f.bizRegion,
          postal_code: f.bizPostal,
          country: f.bizCountry,
        },
        businessDescription: f.businessDescription,
        mcc: f.mcc || undefined,
        defaultStatementDescriptor: f.defaultStatementDescriptor || undefined,
        ownerFirstName: f.ownerFirstName,
        ownerLastName: f.ownerLastName,
        ownerTitle: f.ownerTitle || undefined,
        ownerEmail: f.ownerEmail,
        ownerPhone: f.ownerPhone,
        ownerTaxId: f.ownerTaxId || undefined,
        ownerPersonalAddress: {
          line1: f.perLine1,
          city: f.perCity,
          region: f.perRegion,
          postal_code: f.perPostal,
          country: f.perCountry,
        },
        principalPercentageOwnership: f.principalPercentageOwnership
          ? Number(f.principalPercentageOwnership)
          : undefined,
      });
      setResult(res);
    } catch (e) {
      setResult({ error: "Request threw: " + String(e) });
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Finix sub-merchant onboarding</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
        Creates a seller Identity and provisions a Merchant (DUMMY_V1 sandbox),
        then saves the Finix IDs onto the current business.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
        <Field label="Business name" value={f.businessName} onChange={set("businessName")} />
        <Field label="Doing business as" value={f.doingBusinessAs} onChange={set("doingBusinessAs")} />

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Business type</span>
          <select
            value={f.businessType}
            onChange={(e) => set("businessType")(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
          >
            <option value="INDIVIDUAL_SOLE_PROPRIETORSHIP">Sole proprietorship</option>
            <option value="CORPORATION">Corporation</option>
            <option value="LIMITED_LIABILITY_COMPANY">LLC</option>
            <option value="PARTNERSHIP">Partnership</option>
          </select>
        </label>

        <Field label="MCC" value={f.mcc} onChange={set("mcc")} />
        <Field label="Business phone" value={f.businessPhone} onChange={set("businessPhone")} />
        <Field label="Business tax ID (test)" value={f.businessTaxId} onChange={set("businessTaxId")} />
        <Field label="Statement descriptor" value={f.defaultStatementDescriptor} onChange={set("defaultStatementDescriptor")} />
        <Field label="Ownership %" value={f.principalPercentageOwnership} onChange={set("principalPercentageOwnership")} />

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, gridColumn: "1 / span 2" }}>
          <span style={{ color: "#555" }}>Business description</span>
          <input
            value={f.businessDescription}
            onChange={(e) => set("businessDescription")(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
          />
        </label>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Business address</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Field label="Line 1" value={f.bizLine1} onChange={set("bizLine1")} />
        <Field label="City" value={f.bizCity} onChange={set("bizCity")} />
        <Field label="Region (e.g. ON)" value={f.bizRegion} onChange={set("bizRegion")} />
        <Field label="Postal code" value={f.bizPostal} onChange={set("bizPostal")} />
        <Field label="Country (CAN)" value={f.bizCountry} onChange={set("bizCountry")} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Owner / control person</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Field label="First name" value={f.ownerFirstName} onChange={set("ownerFirstName")} />
        <Field label="Last name" value={f.ownerLastName} onChange={set("ownerLastName")} />
        <Field label="Title" value={f.ownerTitle} onChange={set("ownerTitle")} />
        <Field label="Email" value={f.ownerEmail} onChange={set("ownerEmail")} />
        <Field label="Phone" value={f.ownerPhone} onChange={set("ownerPhone")} />
        <Field label="Personal tax ID / SIN (test)" value={f.ownerTaxId} onChange={set("ownerTaxId")} />
        <Field label="Address line 1" value={f.perLine1} onChange={set("perLine1")} />
        <Field label="City" value={f.perCity} onChange={set("perCity")} />
        <Field label="Region" value={f.perRegion} onChange={set("perRegion")} />
        <Field label="Postal code" value={f.perPostal} onChange={set("perPostal")} />
        <Field label="Country" value={f.perCountry} onChange={set("perCountry")} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: 20,
          padding: "10px 18px",
          background: loading ? "#94a3b8" : "#2563EB",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Onboarding..." : "Onboard this business"}
      </button>

      {result ? (
        <pre
          style={{
            marginTop: 16,
            whiteSpace: "pre-wrap",
            background: "ok" in result ? "#ecfdf5" : "#fef2f2",
            border: "1px solid " + ("ok" in result ? "#a7f3d0" : "#fecaca"),
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#555" }}>{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder || ""}
        style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
      />
    </label>
  );
}