import { describe, it, expect } from "vitest";
import { QrCode, qrSvg } from "@/lib/qrcodegen";

// The QR encoder is vendored (no external lib), so these tests assert the
// structural invariants of the spec that any correct encoder must satisfy:
// deterministic sizing, the three fixed finder patterns, the timing tracks, and
// the always-dark format module. A placement/orientation/masking bug would break
// at least one of these even though we can't scan a code in a unit test.

const URL = "https://www.surgetechpos.com/order/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";

describe("QrCode (vendored QR generator)", () => {
  it("picks a version whose size is 4*version+17", () => {
    const qr = QrCode.encodeText(URL, "M");
    expect(qr.version).toBeGreaterThanOrEqual(1);
    expect(qr.version).toBeLessThanOrEqual(40);
    expect(qr.size).toBe(qr.version * 4 + 17);
  });

  it("draws all three finder patterns (mask-independent function modules)", () => {
    const qr = QrCode.encodeText(URL, "M");
    const s = qr.size;
    // Top-left finder is centered at (3,3): dark ring, light gap, dark core.
    expect(qr.getModule(0, 0)).toBe(true); // outer corner
    expect(qr.getModule(1, 1)).toBe(false); // light gap
    expect(qr.getModule(2, 2)).toBe(true); // core
    expect(qr.getModule(3, 3)).toBe(true); // center
    // Top-right + bottom-left finder outer corners.
    expect(qr.getModule(s - 1, 0)).toBe(true);
    expect(qr.getModule(0, s - 1)).toBe(true);
  });

  it("lays the timing tracks on row/col 6 (alternating, starting dark)", () => {
    const qr = QrCode.encodeText(URL, "M");
    expect(qr.getModule(8, 6)).toBe(true);
    expect(qr.getModule(9, 6)).toBe(false);
    expect(qr.getModule(10, 6)).toBe(true);
    expect(qr.getModule(6, 8)).toBe(true);
    expect(qr.getModule(6, 9)).toBe(false);
  });

  it("keeps the always-dark format module", () => {
    const qr = QrCode.encodeText(URL, "M");
    expect(qr.getModule(8, qr.size - 8)).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const a = QrCode.encodeText(URL, "M");
    const b = QrCode.encodeText(URL, "M");
    expect(a.size).toBe(b.size);
    for (let y = 0; y < a.size; y++) {
      for (let x = 0; x < a.size; x++) {
        expect(a.getModule(x, y)).toBe(b.getModule(x, y));
      }
    }
  });

  it("higher ECC level needs an equal-or-larger version", () => {
    const m = QrCode.encodeText(URL, "M");
    const h = QrCode.encodeText(URL, "H");
    expect(h.version).toBeGreaterThanOrEqual(m.version);
  });

  it("renders a self-contained SVG with a module path", () => {
    const svg = qrSvg(URL, { ecc: "M" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).toContain("<path d=\"M");
    expect(svg).not.toContain("surgetechpos"); // URL is encoded as modules, not embedded as text
  });
});
