import { describe, it, expect } from "vitest";
import { CHECK_NAME_MAX, normalizeCheckName, partySummary } from "@surge/api-contracts";

// open_tickets.label holds the name of every kind of check: a party at a table
// ("Okafor"), a to-go order ("Ana"), a bar tab ("Jake"). Four call sites used to
// each carry their own copy of the trim/slice/null rule below. This is that rule,
// once, plus the one-line party summary both floors draw from it.

describe("check names", () => {
  it("keeps a normal name as written", () => {
    expect(normalizeCheckName("Okafor")).toBe("Okafor");
  });

  it("trims the padding a touch keyboard adds", () => {
    // An iPad keyboard puts a space after an autocompleted word, so a name
    // typed at the door arrives with a trailing space more often than not.
    expect(normalizeCheckName("  Okafor ")).toBe("Okafor");
  });

  it("treats empty and whitespace-only as no name at all", () => {
    // Not "": a check whose name is the empty string would draw a separator
    // with nothing before it on every tile, and would read as named to any
    // `if (name)` downstream.
    expect(normalizeCheckName("")).toBeNull();
    expect(normalizeCheckName("   ")).toBeNull();
    expect(normalizeCheckName(null)).toBeNull();
    expect(normalizeCheckName(undefined)).toBeNull();
  });

  it("clearing the field is a rename to nothing, not a rejected rename", () => {
    // The host opens Rename party, selects all, deletes, saves. That has to
    // remove the name — the party paid and the table turned.
    expect(normalizeCheckName("")).toBeNull();
  });

  it("caps a pasted essay at the column's limit", () => {
    const long = "x".repeat(500);
    expect(normalizeCheckName(long)).toHaveLength(CHECK_NAME_MAX);
  });

  it("trims before it slices, so padding never eats real characters", () => {
    // Order matters: slice-then-trim on a padded 80-char name would silently
    // drop the last letters and still come back under the cap.
    const padded = "   " + "a".repeat(CHECK_NAME_MAX);
    expect(normalizeCheckName(padded)).toBe("a".repeat(CHECK_NAME_MAX));
  });

  it("keeps names that are not ASCII intact", () => {
    // The whole point of this field is that a host writes down what they heard.
    expect(normalizeCheckName("Bergström")).toBe("Bergström");
    expect(normalizeCheckName("中村")).toBe("中村");
  });
});

describe("party summary line", () => {
  it("reads name then size, the way it is said out loud", () => {
    expect(partySummary("Okafor", 4)).toBe("Okafor · 4 guests");
  });

  it("says one guest, not 1 guests", () => {
    expect(partySummary("Silva", 1)).toBe("Silva · 1 guest");
  });

  it("shows whichever half it has", () => {
    expect(partySummary("Okafor", null)).toBe("Okafor");
    expect(partySummary(null, 4)).toBe("4 guests");
  });

  it("returns nothing at all when it knows neither", () => {
    // The caller drops the line entirely. Returning " · " or "0 guests" would
    // put a fragment on the tile that means nothing.
    expect(partySummary(null, null)).toBe("");
    expect(partySummary("", 0)).toBe("");
  });

  it("does not print a party of zero", () => {
    // guest_count is nullable and a badly-typed caller can hand over 0; a table
    // seating nobody is not a fact worth printing.
    expect(partySummary("Okafor", 0)).toBe("Okafor");
  });

  it("ignores a nonsense size rather than rendering NaN on the floor", () => {
    expect(partySummary("Okafor", Number.NaN)).toBe("Okafor");
    expect(partySummary("Okafor", -3)).toBe("Okafor");
  });

  it("normalises the name it is handed, so callers cannot leak padding", () => {
    expect(partySummary("  Okafor  ", 2)).toBe("Okafor · 2 guests");
  });
});
