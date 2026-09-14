import type { ReactNode } from "react";
import { ProductPreviewBadge } from "./coming-soon-badge";
import { PRODUCT_PREVIEW_NOTE } from "@/lib/services/terminal-availability";

// THE PRODUCT-PREVIEW PANEL — the tablet frame the POS screens sit inside.
//
// CODE-NATIVE, NOT A CROPPED MOCKUP. DESIGN-SYSTEM.md: "Build tablet interfaces
// with actual product captures or code-native components, not regenerated small
// text." Everything inside this frame is real DOM — selectable, translatable,
// zoomable, readable by a screen reader, and legible at 375px where a 971px-wide
// raster of a tablet UI is an illegible smear.
//
// THE BADGE IS STRUCTURAL. CONTENT-AND-LAUNCH-RULES.md requires unbuilt
// functionality to be labelled "Product preview"; putting the badge in the
// frame rather than beside each usage means a screen cannot be shown without
// it. The note under the frame carries the second half of the rule — that the
// numbers inside are illustrative and are not an offer or a result.
//
// THE BEZEL IS A DEVICE FRAME, NOT A CARD EDGE. 01-home.jpg draws each screen
// inside a tablet: an 8px near-black band with a 22px outer radius, with a
// single hairline ring around it so the black body separates from the charcoal
// band behind it. The earlier 6px #2c3037 border read as a slightly darker card
// on a dark surface — the shapes stopped looking like hardware. The ring is one
// flat 2px line, not a glow and not a drop shadow.

export function ProductPreviewFrame({
  children,
  screenLabel,
  className = "",
}: {
  children: ReactNode;
  /** Names the screen for assistive tech, e.g. "Floor plan". */
  screenLabel: string;
  className?: string;
}) {
  return (
    <figure className={"relative " + className}>
      <div className="absolute -top-3 left-6 z-10">
        <ProductPreviewBadge />
      </div>
      <div
        role="img"
        aria-label={screenLabel + " — " + PRODUCT_PREVIEW_NOTE}
        className="overflow-hidden rounded-[22px] border-[8px] border-[#0b0d10] bg-[var(--surge-surface)] shadow-[0_0_0_2px_rgba(255,255,255,0.20)]"
      >
        {/* aria-hidden on the inner tree: the frame already carries one
            accessible name, and announcing forty table numbers from an
            illustrative screenshot is noise, not information. The text stays
            real DOM for selection, zoom and translation. */}
        <div aria-hidden="true" className="p-2.5 text-[var(--surge-ink)]">
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-[length:var(--surge-micro)] text-[var(--surge-on-dark-muted)]">
        {PRODUCT_PREVIEW_NOTE}
      </figcaption>
    </figure>
  );
}
