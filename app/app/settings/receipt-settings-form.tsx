"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildReceiptHtml,
  mergeReceiptSettings,
  sampleReceipt,
  type ReceiptSettings,
  type ReceiptStyle,
} from "../pos/receipt-template";
import { saveReceiptSettings } from "../pos/receipt-actions";

const STYLES: { key: ReceiptStyle; label: string; hint: string }[] = [
  { key: "minimal", label: "Minimal", hint: "Clean and airy" },
  { key: "classic", label: "Classic", hint: "Traditional, full detail" },
  { key: "bold", label: "Bold", hint: "Inverted header bar" },
];

export function ReceiptSettingsForm({ initial, businessName }: { initial: Partial<ReceiptSettings> | null; businessName: string }) {
  const [s, setS] = useState<ReceiptSettings>(mergeReceiptSettings(initial));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSaved(false);
    setMsg(null);
    setS(function (prev) {
      const next = { ...prev };
      next[key] = value;
      return next;
    });
  }

  const previewHtml = useMemo(
    function () {
      return buildReceiptHtml(sampleReceipt(s.headerName.trim() || businessName), s, 54);
    },
    [s, businessName]
  );

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveReceiptSettings(s);
      if ("error" in res) {
        setMsg(res.error);
        setSaved(false);
        return;
      }
      setSaved(true);
      setMsg("Receipt settings saved.");
    });
  }

  function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
        {children}
      </label>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
      <div className="space-y-5">
        <div>
          <Label className="text-xs">Style</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {STYLES.map((opt) => {
              const active = s.style === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set("style", opt.key)}
                  className={"text-left p-2.5 rounded-md border transition-colors " + (active ? "border-foreground bg-accent" : "border-border hover:border-foreground/40")}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Header</div>
          <div>
            <Label className="text-xs">Business name on receipt</Label>
            <Input value={s.headerName} onChange={(e) => set("headerName", e.target.value)} placeholder={businessName} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Tagline (optional)</Label>
            <Input value={s.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="e.g. Salon & Spa" className="h-9 mt-1" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Contact details</div>
          <div className="space-y-2">
            <Toggle checked={s.showAddress} onChange={(v) => set("showAddress", v)}>Show address</Toggle>
            {s.showAddress && (
              <textarea value={s.address} onChange={(e) => set("address", e.target.value)} placeholder="123 King St W, Oshawa ON" rows={2} className="w-full rounded-md border border-border bg-transparent text-foreground px-2 py-1.5 text-sm" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Toggle checked={s.showPhone} onChange={(v) => set("showPhone", v)}>Show phone</Toggle>
              {s.showPhone && <Input value={s.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(905) 555-0123" className="h-9" />}
            </div>
            <div className="space-y-1">
              <Toggle checked={s.showWebsite} onChange={(v) => set("showWebsite", v)}>Show website</Toggle>
              {s.showWebsite && <Input value={s.website} onChange={(e) => set("website", e.target.value)} placeholder="slaspa.com" className="h-9" />}
            </div>
            <div className="space-y-1">
              <Toggle checked={s.showEmail} onChange={(v) => set("showEmail", v)}>Show email</Toggle>
              {s.showEmail && <Input value={s.email} onChange={(e) => set("email", e.target.value)} placeholder="hi@slaspa.com" className="h-9" />}
            </div>
            <div className="space-y-1">
              <Toggle checked={s.showTaxNumber} onChange={(v) => set("showTaxNumber", v)}>Show tax number</Toggle>
              {s.showTaxNumber && <Input value={s.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} placeholder="80000 1234 RT0001" className="h-9" />}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Body</div>
          <div className="space-y-2">
            <Toggle checked={s.showSaleNumber} onChange={(v) => set("showSaleNumber", v)}>Show sale number</Toggle>
            <Toggle checked={s.showDateTime} onChange={(v) => set("showDateTime", v)}>Show date and time</Toggle>
            <Toggle checked={s.showCustomer} onChange={(v) => set("showCustomer", v)}>Show customer name (when attached)</Toggle>
            <Toggle checked={s.showTableName} onChange={(v) => set("showTableName", v)}>Show table name (on the bill)</Toggle>
            <Toggle checked={s.showServerName} onChange={(v) => set("showServerName", v)}>Show server name (on the bill)</Toggle>
          </div>
          <div>
            <Label className="text-xs">Tax line label</Label>
            <Input value={s.taxLabel} onChange={(e) => set("taxLabel", e.target.value)} placeholder="Tax (or e.g. HST 13%)" className="h-9 mt-1" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Footer</div>
          <div>
            <Label className="text-xs">Thank-you message</Label>
            <textarea value={s.footerMessage} onChange={(e) => set("footerMessage", e.target.value)} rows={2} placeholder="Thank you!" className="w-full rounded-md border border-border bg-transparent text-foreground px-2 py-1.5 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Return / refund policy (optional)</Label>
            <textarea value={s.footerPolicy} onChange={(e) => set("footerPolicy", e.target.value)} rows={2} placeholder="Returns within 14 days with receipt." className="w-full rounded-md border border-border bg-transparent text-foreground px-2 py-1.5 text-sm mt-1" />
          </div>
          <div className="space-y-1">
            <Toggle checked={s.showSocial} onChange={(v) => set("showSocial", v)}>Show social handle</Toggle>
            {s.showSocial && <Input value={s.social} onChange={(e) => set("social", e.target.value)} placeholder="Follow @slaspa" className="h-9" />}
          </div>
          <div className="space-y-1">
            <Toggle checked={s.showTipGuide} onChange={(v) => set("showTipGuide", v)}>Show tip guide (suggested tip amounts)</Toggle>
            {s.showTipGuide && (
              <div>
                <Label className="text-xs">Tip guide percentages (comma-separated)</Label>
                <Input value={s.tipGuidePcts} onChange={(e) => set("tipGuidePcts", e.target.value)} placeholder="15, 18, 20" className="h-9 mt-1" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save receipt settings"}
          </Button>
          {msg && <span className={"text-sm " + (saved ? "text-emerald-600" : "text-red-600")}>{msg}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 self-start">
        <div className="text-xs text-muted-foreground mb-2">Live preview</div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 flex justify-center">
          <iframe
            title="Receipt preview"
            srcDoc={previewHtml}
            className="bg-white rounded shadow-sm"
            style={{ width: "226px", height: "440px", border: "none" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Sample data shown at 60mm width.</p>
      </div>
    </div>
  );
}