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
// The bezel is a flat charcoal border with a 12px radius, not a photographed
// device and not a drop-shadowed slab: "no exaggerated shadows".

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
      <div className="absolute -top-3 left-4 z-10">
        <ProductPreviewBadge />
      </div>
      <div
        role="img"
        aria-label={screenLabel + " — " + PRODUCT_PREVIEW_NOTE}
        className="overflow-hidden rounded-[16px] border-[6px] border-[#2c3037] bg-[var(--surge-surface)]"
      >
        {/* aria-hidden on the inner tree: the frame already carries one
            accessible name, and announcing forty table numbers from an
            illustrative screenshot is noise, not information. The text stays
            real DOM for selection, zoom and translation. */}
        <div aria-hidden="true" className="p-3 text-[var(--surge-ink)] sm:p-4">
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-[length:var(--surge-micro)] text-[var(--surge-on-dark-muted)]">
        {PRODUCT_PREVIEW_NOTE}
      </figcaption>
    </figure>
  );
}
