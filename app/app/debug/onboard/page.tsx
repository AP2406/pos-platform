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
  url: string;
  mcc: string;
  defaultStatementDescriptor: string;
  incorporationDate: string;
  annualCardVolume: string;
  maxTransactionAmount: string;
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
  ownerDob: string;
  perLine1: string;
  perCity: string;
  perRegion: string;
  perPostal: string;
  perCountry: string;
  principalPercentageOwnership: string;
  bankName: string;
  bankAccountType: string;
  bankInstitutionNumber: string;
  bankTransitNumber: string;
  bankAccountNumber: string;
};

const DEFAULTS: FieldState = {
  businessName: "Pearson Limo Toronto",
  doingBusinessAs: "Pearson Limo Toronto",
  businessType: "INDIVIDUAL_SOLE_PROPRIETORSHIP",
  businessDescription: "Airport limousine and private car transfer service",
  businessPhone: "4160000000",
  businessTaxId: "123456789",
  url: "https://pearsonlimo.example",
  mcc: "4121",
  defaultStatementDescriptor: "PEARSON LIMO",
  incorporationDate: "2020-03-01",
  annualCardVolume: "250000",
  maxTransactionAmount: "2000",
  bizLine1: "100 King St W",
  bizCity: "Toronto",
  bizRegion: "ON",
  bizPostal: "M5X 1A9",
  bizCountry: "CAN",
  ownerFirstName: "Aathi",
  ownerLastName: "Panchalingam",
  ownerTitle: "Owner",
  ownerEmail: "owner@pearsonlimo.example",
  ownerPhone: "4160000000",
  ownerTaxId: "000000000",
  ownerDob: "1990-06-15",
  perLine1: "100 King St W",
  perCity: "Toronto",
  perRegion: "ON",
  perPostal: "M5X 1A9",
  perCountry: "CAN",
  principalPercentageOwnership: "100",
  bankName: "Aathi Panchalingam",
  bankAccountType: "PERSONAL_CHECKING",
  bankInstitutionNumber: "123",
  bankTransitNumber: "12345",
  bankAccountNumber: "123123123",
};

type OnboardResult =
  | { ok: true; identityId: string; bankInstrumentId: string; merchantId: string; state: string }
  | { error: string; details?: unknown };

function parseDate(s: string): { day: number; month: number; year: number } | undefined {
  if (!s) return undefined;
  const parts = s.split("-");
  if (parts.length !== 3) return undefined;
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

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
      const res = await onboardCurrentBusiness(
        {
          businessName: f.businessName,
          doingBusinessAs: f.doingBusinessAs || undefined,
          businessType: f.businessType as never,
          businessPhone: f.businessPhone,
          businessTaxId: f.businessTaxId || undefined,
          url: f.url || undefined,
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
          incorporationDate: parseDate(f.incorporationDate),
          annualCardVolumeCents: f.annualCardVolume
            ? Math.round(Number(f.annualCardVolume) * 100)
            : undefined,
          maxTransactionAmountCents: f.maxTransactionAmount
            ? Math.round(Number(f.maxTransactionAmount) * 100)
            : undefined,
          ownerFirstName: f.ownerFirstName,
          ownerLastName: f.ownerLastName,
          ownerTitle: f.ownerTitle || undefined,
          ownerEmail: f.ownerEmail,
          ownerPhone: f.ownerPhone,
          ownerTaxId: f.ownerTaxId || undefined,
          ownerDob: parseDate(f.ownerDob),
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
        },
        {
          name: f.bankName,
          accountNumber: f.bankAccountNumber,
          accountType: f.bankAccountType,
          institutionNumber: f.bankInstitutionNumber,
          transitNumber: f.bankTransitNumber,
          country: "CAN",
          currency: "CAD",
        }
      );
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
        Creates a seller Identity, attaches a settlement bank account, and
        provisions a Merchant (DUMMY_V1 sandbox), then saves the Finix IDs onto
        the current business.
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

        <Field label="Website URL" value={f.url} onChange={set("url")} />
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

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Required for sole proprietorship</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Incorporation / start date</span>
          <input
            type="date"
            value={f.incorporationDate}
            onChange={(e) => set("incorporationDate")(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
          />
        </label>
        <div />
        <Field label="Annual card volume (CAD)" value={f.annualCardVolume} onChange={set("annualCardVolume")} />
        <Field label="Max transaction (CAD)" value={f.maxTransactionAmount} onChange={set("maxTransactionAmount")} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Business address</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Field label="Line 1" value={f.bizLine1} onChange={set("bizLine1")} />
        <Field label="City" value={f.bizCity} onChange={set("bizCity")} />
        <Field label="Region (e.g. ON)" value={f.bizRegion} onChange={set("bizRegion")} />
        <Field label="Postal code (M5X 1A9)" value={f.bizPostal} onChange={set("bizPostal")} />
        <Field label="Country (CAN)" value={f.bizCountry} onChange={set("bizCountry")} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Owner / control person</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Field label="First name" value={f.ownerFirstName} onChange={set("ownerFirstName")} />
        <Field label="Last name" value={f.ownerLastName} onChange={set("ownerLastName")} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Date of birth</span>
          <input
            type="date"
            value={f.ownerDob}
            onChange={(e) => set("ownerDob")(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
          />
        </label>
        <Field label="Title" value={f.ownerTitle} onChange={set("ownerTitle")} />
        <Field label="Email" value={f.ownerEmail} onChange={set("ownerEmail")} />
        <Field label="Phone" value={f.ownerPhone} onChange={set("ownerPhone")} />
        <Field label="Personal tax ID / SIN (test)" value={f.ownerTaxId} onChange={set("ownerTaxId")} />
        <Field label="Address line 1" value={f.perLine1} onChange={set("perLine1")} />
        <Field label="City" value={f.perCity} onChange={set("perCity")} />
        <Field label="Region" value={f.perRegion} onChange={set("perRegion")} />
        <Field label="Postal code (M5X 1A9)" value={f.perPostal} onChange={set("perPostal")} />
        <Field label="Country" value={f.perCountry} onChange={set("perCountry")} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Settlement bank account</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Field label="Account holder name" value={f.bankName} onChange={set("bankName")} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Account type</span>
          <select
            value={f.bankAccountType}
            onChange={(e) => set("bankAccountType")(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }}
          >
            <option value="PERSONAL_CHECKING">Personal checking</option>
            <option value="BUSINESS_CHECKING">Business checking</option>
            <option value="PERSONAL_SAVINGS">Personal savings</option>
            <option value="BUSINESS_SAVINGS">Business savings</option>
          </select>
        </label>
        <Field label="Institution number (3 digits)" value={f.bankInstitutionNumber} onChange={set("bankInstitutionNumber")} />
        <Field label="Transit number (5 digits)" value={f.bankTransitNumber} onChange={set("bankTransitNumber")} />
        <Field label="Account number" value={f.bankAccountNumber} onChange={set("bankAccountNumber")} />
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