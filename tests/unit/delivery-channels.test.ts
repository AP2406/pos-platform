import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DELIVERY_CHANNELS, isDeliveryChannel } from "@surge/api-contracts";

// The one list of delivery platforms, shared by the web app and the iPad app.
//
// It is pinned here because three private copies of it were the defect: a real
// DoorDash order read as "In-store" on the reports split, "Other" in the web
// Orders hub, and "Dine-in" on the iPad. The last one is the one a server sees
// mid-service.

describe("delivery platform list", () => {
  it("matches exactly what migration 0074 can write", () => {
    // 0074 normalises any unrecognised platform to the literal 'delivery', so
    // these four are the complete set. If this fails, either the migration
    // gained a platform and the list did not, or vice versa.
    expect([...DELIVERY_CHANNELS].sort()).toEqual(
      ["delivery", "doordash", "grubhub", "ubereats"].sort()
    );
  });

  it("stays in step with the migration that writes the column", () => {
    // Read the migration rather than trusting a comment about it: the failure
    // mode being guarded is someone adding a platform in SQL and nowhere else.
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0074_delivery_aggregation.sql"),
      "utf8"
    );
    const guard = sql.match(/v_platform\s+not\s+in\s*\(([^)]*)\)/i);
    expect(guard, "0074 no longer has the platform allow-list this test reads").toBeTruthy();
    const fromSql = [...guard![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    // The migration lists the recognised platforms; 'delivery' is its fallback
    // for everything else, so the shared list is that set plus the fallback.
    expect([...DELIVERY_CHANNELS].sort()).toEqual([...fromSql, "delivery"].sort());
  });

  it("tolerates the casing and padding a free-text column can hold", () => {
    // orders.channel is plain text — no enum, no CHECK constraint.
    expect(isDeliveryChannel("DoorDash")).toBe(true);
    expect(isDeliveryChannel("  ubereats  ")).toBe(true);
    expect(isDeliveryChannel("GRUBHUB")).toBe(true);
  });

  it("does not match on substrings", () => {
    // The original bug was `channel.includes("delivery")`, which caught nothing
    // it needed to. Guard the opposite error too.
    expect(isDeliveryChannel("delivery-cancelled")).toBe(false);
    expect(isDeliveryChannel("not-doordash")).toBe(false);
  });

  it("treats absent and empty as not-a-delivery", () => {
    // A till writes NULL, and that is an in-store sale, not an unknown one.
    expect(isDeliveryChannel(null)).toBe(false);
    expect(isDeliveryChannel(undefined)).toBe(false);
    expect(isDeliveryChannel("")).toBe(false);
    expect(isDeliveryChannel("   ")).toBe(false);
  });
});
