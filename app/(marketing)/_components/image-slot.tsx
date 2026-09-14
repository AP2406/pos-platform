// THE PHOTOGRAPHY PLACEHOLDER, AND WHY THE SITE SHIPS WITH VISIBLE HOLES.
//
// The mockups are illustrated with AI-generated hospitality photography that
// cannot be reproduced, and the launch rules forbid both stock photography
// standing in as if it were ours and anything a reader could mistake for
// customer testimony ("Generated people are illustrative models, not Surge
// employees or endorsers"). The repo's existing marketing photos are the wrong
// subject for this design and carry the same problem.
//
// So every photographic slot renders as a flat --surge-warm block at the exact
// aspect ratio the real picture needs, with the shot brief printed on it. Three
// consequences, all intended:
//
//   1. IT IS OBVIOUS. Nobody ships this to production by accident, and the
//      owner can see at a glance which photographs are outstanding.
//   2. IT DOES NOT REFLOW. The block owns the same box the photograph will,
//      so dropping in a real <Image fill> changes pixels and nothing else.
//   3. IT IS HONEST. No stock, no mockup JPG cut up into a page, no generated
//      person implying a customer.
//
// Each slot carries `data-image-slot` with its id so the full list can be
// enumerated from the served HTML — see docs/site-redesign/.
//
// REPLACING ONE: swap the <div> for `<Image src=… alt={alt} fill sizes=…
// className="object-cover" />` inside the same wrapper and delete the brief.

/** One commissioned photograph. `ratio` is a raw CSS aspect-ratio value. */
export type ImageSlotSpec = {
  /** Stable id, printed into data-image-slot and used in the shot list. */
  id: string;
  /** CSS aspect-ratio, e.g. "4 / 3". */
  ratio: string;
  /** What has to be in the frame. Shown on the placeholder and kept as the brief. */
  brief: string;
  /**
   * The alt text the real photograph will carry. Empty string marks the picture
   * as decorative — the placeholder is then hidden from assistive tech entirely
   * rather than announcing a brief no visitor needs.
   */
  alt: string;
};

export function ImageSlot({
  spec,
  className = "",
  rounded = true,
  fill = false,
  labelAlign = "bottom",
}: {
  spec: ImageSlotSpec;
  className?: string;
  /** Off for a slot that bleeds to the edge of the viewport. */
  rounded?: boolean;
  /**
   * Where the brief sits in the block. "top" for a slot whose bottom edge is
   * covered by something else — the solutions cards put their caption bar
   * there, and two stacks of text in the same corner is unreadable. A real
   * photograph makes this prop moot.
   */
  labelAlign?: "top" | "bottom";
  /**
   * Drop the aspect ratio and take the height of the parent instead. For the
   * two slots that bleed the full height of a band, where the ratio is decided
   * by the band rather than by the photograph. The ratio in `spec` is still
   * the one to crop to — it is the shot brief, not the CSS.
   */
  fill?: boolean;
}) {
  const decorative = spec.alt === "";
  return (
    <div
      data-image-slot={spec.id}
      // role/aria-label only when the real photo will be meaningful. A
      // decorative slot is aria-hidden so a screen reader is not read a
      // production note.
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : spec.alt}
      aria-hidden={decorative ? true : undefined}
      style={fill ? undefined : { aspectRatio: spec.ratio }}
      className={
        "flex w-full overflow-hidden border border-dashed border-[var(--surge-border-control)] bg-[var(--surge-warm)] " +
        (labelAlign === "top" ? "items-start " : "items-end ") +
        (rounded ? "rounded-[var(--surge-radius-card)] " : "") +
        (fill ? "h-full " : "") +
        className
      }
    >
      {/* min-w-0 + line-clamp so a long brief in a small slot (the 1:1 terminal
          render is only ~240px wide) truncates instead of spilling past the
          block and colliding with the coming-soon pill. */}
      <div className="w-full min-w-0 p-4">
        <p className="text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-muted)]">
          Photography slot
        </p>
        <p className="mt-1 line-clamp-3 max-w-[46ch] text-[length:var(--surge-micro)] leading-snug text-[var(--surge-muted)]">
          {spec.brief}
        </p>
        <p className="mt-1 truncate font-mono text-[11px] text-[var(--surge-muted)]">{spec.id}</p>
      </div>
    </div>
  );
}

/**
 * Every photograph the home page needs, in one exported list.
 *
 * Kept as data rather than inlined so the shot list in the report and the
 * markup are the same source — an image that is not in here cannot be on the
 * page, and a shot that gets commissioned has exactly one place to land.
 */
export const HOME_IMAGE_SLOTS = {
  hero: {
    id: "home-hero-owner-counter",
    ratio: "4 / 3",
    brief:
      "Adult female cafe owner at her own counter, working a slim tablet on a low stand, generic elongated keypad reader beside it. Warm daylight, real room behind her, no processor branding.",
    alt: "A cafe owner taking an order on a tablet at her counter, with a card reader beside it",
  },
  restaurants: {
    id: "home-solution-restaurants",
    ratio: "12 / 5",
    brief:
      "Restaurant service in progress — plated food on a pass or a table mid-service. People may be out of focus. No hero portrait, no visible branding.",
    alt: "",
  },
  retail: {
    id: "home-solution-retail",
    ratio: "12 / 5",
    brief:
      "Adult male shop or counter staff member using a handheld tablet at a service counter, generic elongated keypad reader on the counter beside him.",
    alt: "",
  },
  terminal: {
    id: "home-terminal-concept",
    ratio: "1 / 1",
    brief:
      "Product render of the planned Surge reader: generic unbranded elongated keypad terminal, three-quarter view, plain light background, no cables. Concept render — not final hardware.",
    alt: "Concept render of the planned Surge payment terminal",
  },
  closing: {
    id: "home-closing-counter",
    ratio: "12 / 5",
    brief:
      "Quiet counter detail before opening — stacked plates, a plant, timber counter. No people, no devices. Used as a bleed behind the closing CTA.",
    alt: "",
  },
} as const satisfies Record<string, ImageSlotSpec>;
