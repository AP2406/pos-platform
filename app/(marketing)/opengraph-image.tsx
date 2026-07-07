import { ImageResponse } from "next/og";

// Site-wide social card (section 2). Rendered at build by Next — no binary asset to
// maintain — and the absolute www URL is derived automatically from metadataBase.
export const alt = "Surge — transparent payment processing and POS for the GTA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          color: "#ffffff",
          backgroundColor: "#0b0e14",
          backgroundImage:
            "radial-gradient(900px 520px at 78% 26%, rgba(56,189,248,0.28), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "44px" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              display: "flex",
              backgroundColor: "#2563eb",
              backgroundImage: "linear-gradient(135deg, #38bdf8, #2563eb)",
            }}
          />
          <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-1px" }}>Surge</div>
        </div>
        <div style={{ fontSize: "88px", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-2px", maxWidth: "920px" }}>
          Stop overpaying to get paid.
        </div>
        <div style={{ fontSize: "34px", color: "#9fb2c8", marginTop: "34px", maxWidth: "820px" }}>
          Transparent payment processing &amp; point-of-sale for the GTA.
        </div>
      </div>
    ),
    size,
  );
}
