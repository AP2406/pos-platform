import { ImageResponse } from "next/og";

// Site-wide social card (section 2). Rendered at build by Next — no binary asset to
// maintain — and the absolute www URL is derived automatically from metadataBase.
export const alt = "Surge — point of sale for restaurants, cafes and retail in the GTA";
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
          // The kit's presentation ink. FLAT: there was a 900x520 radial wash
          // in the kit blue over the top-right of this card, and a radial wash
          // is a gradient with no flat equivalent that isn't a coloured
          // rectangle across a social card. The ink alone is what the kit
          // specifies as the presentation background, and the blue on the card
          // is now only where the blue belongs — in the mark.
          backgroundColor: "#101318",
          fontFamily: "sans-serif",
        }}
      >
        {/* THE MARK, AS REAL GEOMETRY. Satori has no access to the filesystem
            or to an <img src="/brand/*.svg">, so the card cannot reference the
            kit files — it has to carry the paths. These are copied verbatim
            from svg/surge-symbol-flat-dark.svg; only the wrapper sizing is
            ours. `flat-dark` and not the blue-fade `dark`: Satori's inline-SVG
            support does not cover <defs>/<linearGradient>, and flat-dark is
            precisely the no-gradient variant the kit publishes for that case.
            At 108px it is well clear of the 48px line under which the README
            would send us to the optical icons instead.
            The typeset "Surge" beside it is gone. The kit HAS a wordmark and
            an OG card is a brand moment with 1200px of room, so drawing the
            word in the OS's fallback sans next to the real mark was the one
            thing worth fixing here — but the wordmark is 5 long outline paths
            and Satori charges for every one, so the symbol carries it alone
            and the headline below says the name in context. */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "44px" }}>
          <svg width="108" height="108" viewBox="0 0 384 384" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(32 84)">
              <g fill="none" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="#FFFFFF" d="M132 12 H277 A31 31 0 0 1 308 43 V173 A31 31 0 0 1 277 204 H132" />
                <path stroke="#008CFF" d="M66 60 H158 M12 108 H158 M66 156 H158" />
              </g>
            </g>
          </svg>
        </div>
        {/* Every marketing segment re-exports this file, so this headline is
            the social card for the whole site — which is why the payments line
            had to come off here too, not just on the pages. Shorter than the
            old one, and it has to stay short: Satori has no auto-fit, so a
            third line at 88px would run off a 630px-tall card. */}
        <div style={{ fontSize: "88px", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-2px", maxWidth: "920px" }}>
          The till that runs the whole room.
        </div>
        <div style={{ fontSize: "34px", color: "#9fb2c8", marginTop: "34px", maxWidth: "820px" }}>
          Point of sale for restaurants, cafes &amp; retail across the GTA.
        </div>
      </div>
    ),
    size,
  );
}
