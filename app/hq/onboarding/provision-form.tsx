"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { provisionApplication, type ProvisionKyc, type ProvisionBank } from "./provision-actions";

const BUSINESS_TYPES = ["INDIVIDUAL_SOLE_PROPRIETORSHIP", "CORPORATION", "LIMITED_LIABILITY_COMPANY", "PARTNERSHIP"];

export function ProvisionForm({
  applicationId,
  defaultBusinessName,
  defaultOwnerFirst,
  defaultOwnerLast,
}: {
  applicationId: string;
  defaultBusinessName: string;
  defaultOwnerFirst: string;
  defaultOwnerLast: string;
}) {
  const [k, setK] = useState<ProvisionKyc>({
    businessName: defaultBusinessName, businessType: "INDIVIDUAL_SOLE_PROPRIETORSHIP" as ProvisionKyc["businessType"],
    businessTaxId: "", mcc: "5812", line1: "", city: "", region: "ON", postalCode: "",
    ownerFirstName: defaultOwnerFirst, ownerLastName: defaultOwnerLast, ownerDob: "", ownerTaxId: "",
  });
  const [b, setB] = useState<ProvisionBank>({ accountNumber: "", transitNumber: "", institutionNumber: "" });
  const [res, setRes] = useState<{ businessId: string; recoveryLink: string | null; finixMerchantId: string; finixState: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sk = (key: keyof ProvisionKyc) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setK({ ...k, [key]: e.target.value });
  const sb = (key: keyof ProvisionBank) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [key]: e.target.value });

  function go() {
    setErr(null);
    if (!k.businessName || !k.line1 || !k.city || !k.postalCode || !k.ownerFirstName || !b.accountNumber || !b.transitNumber || !b.institutionNumber) {
      setErr("Fill business + owner + bank fields.");
      return;
    }
    if (!confirm("Provision now? This creates a Finix sub-merchant + a new POS tenant.")) return;
    start(async () => {
      const r = await provisionApplication(applicationId, k, b);
      if ("error" in r) { setErr(r.error); return; }
      setRes({ businessId: r.businessId, recoveryLink: r.recoveryLink, finixMerchantId: r.finixMerchantId, finixState: r.finixState });
    });
  }

  if (res) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-emerald-400 font-medium">Provisioned ✓ (Finix {res.finixState})</p>
        <p className="text-zinc-400">Finix merchant: <span className="font-mono text-xs">{res.finixMerchantId}</span></p>
        <p><Link href={"/hq/merchants/" + res.businessId} className="text-emerald-400 hover:underline">Open the new tenant →</Link></p>
        {res.recoveryLink && (
          <div>
            <p className="text-zinc-400 mb-1">Owner set-password link (hand off to the merchant):</p>
            <input readOnly value={res.recoveryLink} onFocus={(e) => e.currentTarget.select()} className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 px-2 text-xs font-mono" />
          </div>
        )}
      </div>
    );
  }

  const inp = "h-9 rounded-md bg-zinc-950 border border-zinc-700 px-2 text-sm w-full";
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">KYC + settlement bank for the Finix sub-merchant, then the POS tenant is created. Sandbox.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <L label="Legal business name"><input className={inp} value={k.businessName} onChange={sk("businessName")} /></L>
        <L label="Business type"><select className={inp} value={k.businessType} onChange={sk("businessType")}>{BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}</select></L>
        <L label="Business tax id"><input className={inp} value={k.businessTaxId} onChange={sk("businessTaxId")} /></L>
        <L label="MCC"><input className={inp} value={k.mcc} onChange={sk("mcc")} /></L>
        <L label="Address line 1"><input className={inp} value={k.line1} onChange={sk("line1")} /></L>
        <L label="City"><input className={inp} value={k.city} onChange={sk("city")} /></L>
        <L label="Region (e.g. ON)"><input className={inp} value={k.region} onChange={sk("region")} /></L>
        <L label="Postal code"><input className={inp} value={k.postalCode} onChange={sk("postalCode")} placeholder="M5V 2T6" /></L>
        <L label="Owner first name"><input className={inp} value={k.ownerFirstName} onChange={sk("ownerFirstName")} /></L>
        <L label="Owner last name"><input className={inp} value={k.ownerLastName} onChange={sk("ownerLastName")} /></L>
        <L label="Owner DOB"><input type="date" className={inp} value={k.ownerDob} onChange={sk("ownerDob")} /></L>
        <L label="Owner tax id (SIN)"><input className={inp} value={k.ownerTaxId} onChange={sk("ownerTaxId")} /></L>
        <L label="Bank account #"><input className={inp} value={b.accountNumber} onChange={sb("accountNumber")} /></L>
        <L label="Transit # (5)"><input className={inp} value={b.transitNumber} onChange={sb("transitNumber")} /></L>
        <L label="Institution # (3)"><input className={inp} value={b.institutionNumber} onChange={sb("institutionNumber")} /></L>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button type="button" onClick={go} disabled={pending} className="h-10 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
        {pending ? "Provisioning…" : "Approve & provision"}
      </button>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] text-zinc-500">{label}</span><div className="mt-0.5">{children}</div></label>;
}
