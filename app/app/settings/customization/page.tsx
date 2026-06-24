import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { CONFIG_KEYS, HUB_SECTIONS } from "@/lib/services/config/registry";
import { getConfigOverview } from "@/lib/services/config/actions";
import { ConfigField, type ClientConfigDef } from "./config-field";

export const dynamic = "force-dynamic";

// Where each hub section's settings live today (legacy cards), until later
// phases migrate them onto the config store.
const SECTION_HINT: Record<string, string> = {
  "Business profile": "Name, tax, currency, timezone — in Settings.",
  "Modules": "Loyalty, kiosk, guest ordering, online booking — in Settings.",
  "Access & roles": "Roles, permissions & caps — Settings → Team. Idle logout below.",
  "Notifications": "Z-report / alert emails — in Settings (CUST-2 will unify these).",
  "Workflow": "KDS, day-close, service charge, tips, exceptions — in Settings.",
  "Layout & screens": "Floor plan, register photos, KDS — in Settings (CUST-4 builders).",
  "Branding": "Theme & language below; receipt design in Settings (CUST-5).",
  "Locations": "Per-location overrides resolve below; consolidated view in Accounting.",
  "Templates": "Concept presets & onboarding wizard — CUST-6.",
};

export default async function CustomizationPage() {
  const { business, role } = await requireBusiness();
  if (!hasFloorService(business)) redirect("/app/settings");

  const orgId = ((business as { org_id?: string | null }).org_id as string) || "";
  const canManage = role === "owner" || role === "manager";

  // Resolve every registered key for the active context (one batched read each).
  const keys = Object.values(CONFIG_KEYS);
  const overviews = await Promise.all(keys.map((d) => getConfigOverview(d.key)));
  const bySection = new Map<string, { def: ClientConfigDef; overviewIdx: number }[]>();
  keys.forEach((d, i) => {
    const cd: ClientConfigDef = { key: d.key, type: d.type, label: d.label, description: d.description, options: d.options, scopes: d.scopes.filter((s): s is "business" | "location" | "user" => s !== "role") };
    const arr = bySection.get(d.section) ?? [];
    arr.push({ def: cd, overviewIdx: i });
    bySection.set(d.section, arr);
  });

  return (
    <div className="max-w-3xl">
      <Link href="/app/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Settings
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Customization</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Shape Surge to your restaurant — at four levels: <span className="font-medium">all locations → this location → role → individual user</span>. Anything you don&apos;t touch keeps its sensible default. Each setting shows where its value comes from, and you can reset to inherited.
        </p>
        {!orgId && <p className="text-xs text-amber-600 mt-2">⚠ Config store not initialized yet — migration 0069 needs to be applied.</p>}
      </div>

      <div className="space-y-6">
        {HUB_SECTIONS.map((section) => {
          const fields = bySection.get(section) ?? [];
          return (
            <section key={section}>
              <h2 className="text-sm font-semibold mb-1">{section}</h2>
              <p className="text-xs text-muted-foreground mb-2">{SECTION_HINT[section]}</p>
              {fields.length > 0 && (
                <div className="space-y-3">
                  {fields.map(({ def, overviewIdx }) => {
                    const ov = overviews[overviewIdx];
                    if (!ov) return null;
                    return <ConfigField key={def.key} def={def} overview={ov} canManage={canManage} orgId={orgId} locationId={business.id} />;
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        This is the foundation (CUST-0). Upcoming phases move Access &amp; roles, Notifications, Workflow, Layout, Branding and Templates fully onto this store with builders and presets.
      </p>
    </div>
  );
}
