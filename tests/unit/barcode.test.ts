import { describe, it, expect } from "vitest";
import { normalizeCode, barcodeIndex, matchBarcode } from "../../mobile/src/lib/barcode";

// Scan-to-add lookup. Locks the leading-zero forgiveness (UPC-A vs EAN-13) and
// the not-found path.

const items = [
  { id: "a", name: "Cola", barcode: "012345678905" }, // UPC-A with leading 0
  { id: "b", name: "Chips", barcode: "5901234123457" }, // EAN-13
  { id: "c", name: "Loose", barcode: null },
  { id: "d", name: "Water", barcode: "  7350053850019  " }, // padded
];

describe("normalizeCode", () => {
  it("trims and drops leading zeros on numeric codes", () => {
    expect(normalizeCode("012345678905")).toBe("12345678905");
    expect(normalizeCode("  7350053850019 ")).toBe("7350053850019");
    expect(normalizeCode("0000")).toBe("0");
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode("ABC-01")).toBe("ABC-01"); // non-numeric kept as-is
  });
});

describe("barcodeIndex + matchBarcode", () => {
  const idx = barcodeIndex(items);

  it("skips items with no barcode", () => {
    expect([...idx.values()].some((i) => i.id === "c")).toBe(false);
  });

  it("matches a scanned code exactly", () => {
    expect(matchBarcode(idx, "5901234123457")?.id).toBe("b");
    expect(matchBarcode(idx, "7350053850019")?.id).toBe("d");
  });

  it("matches across the UPC/EAN leading-zero difference", () => {
    // catalog stored "012345678905"; scanner reports it without the leading zero
    expect(matchBarcode(idx, "12345678905")?.id).toBe("a");
    // and vice-versa
    expect(matchBarcode(idx, "0012345678905")?.id).toBe("a");
  });

  it("returns null for an unknown or empty code", () => {
    expect(matchBarcode(idx, "9999999999999")).toBeNull();
    expect(matchBarcode(idx, "")).toBeNull();
  });
});
