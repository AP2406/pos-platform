import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TIMEZONE IS NOT COSMETIC IN A POS.
//
// It drives businesses.business_day_cutoff, businessDateFor(), the Z-report, the
// reports day-axis (see day-axis.test.ts, which exists because getting this
// class of thing wrong is subtle), table aging and attendance. A restaurant on
// the wrong zone rolls its business day over mid-service and every daily figure
// it reads is wrong — quietly, with no error anywhere.
//
// The picker offered TEN NORTH AMERICAN ZONES in a product sold
// internationally, and docs/pilot-outreach-sri-lanka.md lists that as a reason
// a Colombo pilot could not be delivered. Same shape as the currency bug: a
// setting that existed, had a UI, and could not express what the merchant
// actually needed.

const form = readFileSync(join(process.cwd(), "app/app/settings/settings-form.tsx"), "utf8");
const actions = readFileSync(join(process.cwd(), "app/app/settings/actions.ts"), "utf8");

// Scoped to the TIMEZONE_GROUPS block, not the whole file. A looser regex over
// the file swallows import paths — the first version of this test reported
// "next/navigation" as an invalid timezone, which is funny and also exactly how
// a test ends up asserting something other than what it claims to.
const groupsBlock = form.slice(
  form.indexOf("const TIMEZONE_GROUPS"),
  form.indexOf("export function SettingsForm")
);
const zones = Array.from(groupsBlock.matchAll(/"([A-Za-z]+\/[A-Za-z_]+)"/g)).map((m) => m[1]);

describe("the timezone picker", () => {
  it("offers the pilot market's own zone", () => {
    // The specific thing that blocked Sri Lanka.
    expect(zones).toContain("Asia/Colombo");
  });

  it("covers more than one continent", () => {
    const continents = new Set(zones.map((z) => z.split("/")[0]));
    expect(continents.size).toBeGreaterThan(2);
    expect(continents).toContain("Asia");
    expect(continents).toContain("Europe");
  });

  it("keeps the North American zones that merchants already use", () => {
    // Twelve businesses are on America/Toronto today. Widening the list must
    // not drop what is already selected.
    for (const z of ["America/Toronto", "America/Vancouver", "America/New_York"]) {
      expect(zones).toContain(z);
    }
  });

  it("offers only zones this runtime can actually format", () => {
    // A zone in the list that Intl rejects is a trap: the merchant selects it,
    // it saves, and every report throws.
    for (const z of zones) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: z }).format(new Date()),
        z + " is not a zone Intl accepts").not.toThrow();
    }
  });

  it("does not silently drop a saved zone that is not in the list", () => {
    // Opening settings must never reassign a merchant's timezone just because
    // we have not listed theirs.
    expect(form).toContain("TIMEZONE_GROUPS.some");
  });
});

describe("the server validates it", () => {
  it("checks the zone before writing it", () => {
    const body = actions.slice(actions.indexOf("export async function updateBusinessSettings"));
    const check = body.indexOf("Intl.DateTimeFormat");
    const write = body.indexOf(".update({ name:");
    expect(check).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(check).toBeLessThan(write);
  });

  it("writes the validated value, not the raw input", () => {
    // Trimming and then saving the untrimmed original is the classic version of
    // this mistake.
    const body = actions.slice(actions.indexOf("export async function updateBusinessSettings"));
    expect(body).toContain("timezone: tz");
    expect(body).not.toContain("timezone: input.timezone");
  });

  it("rejects rather than throws, the way Intl behaves", () => {
    // Pinning the actual runtime behaviour this relies on.
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: "Not/AZone" })).toThrow();
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo" })).not.toThrow();
  });
});
