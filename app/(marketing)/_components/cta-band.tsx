import Link from "next/link";
import { Container, Heading, btnPrimary, ArrowRight } from "./primitives";
import { SurgePhoto, type SurgePhotoSpec } from "./photo";

// THE CLOSING CTA BAND.
//
// 01-home.jpg draws it as a warm strip with the heading and sub on the left,
// the button in the middle, and a photograph bleeding off the right edge with
// no border and no rounding.
//
// NO SCRIM, NO FADE. The mockup's photograph dissolves into the warm field
// with a soft left edge. That is a gradient, and every gradient on this site
// was removed on purpose; the handoff independently bans "glow, rainbow
// gradients or exaggerated shadows". The picture therefore ends on a hard edge
// at the halfway line, which is what a flat design system can actually draw.
// Listed as a deviation in the fidelity notes.

export function CtaBand({
  title,
  sub,
  cta,
  href,
  image,
  id,
}: {
  title: string;
  sub?: string;
  cta: string;
  href: string;
  /** Optional bleed photograph on the right. Omitted, the band is text + button only. */
  image?: SurgePhotoSpec & { requiresTerminalStatus: false };
  id?: string;
}) {
  const headingId = (id ?? "cta") + "-title";
  return (
    <section id={id} aria-labelledby={headingId} className="relative overflow-hidden bg-[var(--surge-warm)]">
      {image ? (
        // Hidden below lg: at 375px there is no room for a bleed and the text
        // would sit on top of it. The band is the ask, not the picture.
        //
        // THE LEFT EDGE IS MEASURED FROM THE RAIL, NOT THE VIEWPORT. It was
        // `right:0; width:38%` against this full-width section, i.e. 38% of the
        // VIEWPORT — the same mistake the home hero had, and the same failure
        // mode: on a 1280 display the picture started at 794px and the CTA
        // button ended at 823. `.surge-rail-bleed-right` puts the edge at
        // (rail content-box right) − 0.32 × (rail content width), which is
        // always two points of the rail clear of the 70% the copy and the
        // button share, at every width from 1024 to 2560.
        <div className="surge-rail-bleed-right pointer-events-none absolute inset-y-0 hidden [--surge-bleed-share:0.28] lg:block">
          {/* The box is 32% of the 1240 rail plus the bleed, i.e. about
              `50vw + 40px`; pinned to 1280 past 2000 because the source is
              1536px wide and anything more would be an upscale. */}
          <SurgePhoto photo={image} fill rounded={false} sizes="(min-width: 2000px) 1280px, (min-width: 1024px) 55vw, 0px" />
        </div>
      ) : null}
      {/* The copy and the button are ONE 70% block rather than two flex
          children of the rail, so the pair cannot grow into the picture's
          column as the viewport widens. 70 and not 66: "See Surge at your
          counter." sets to 525px once the H2 reaches its 36px ceiling at 1440,
          and 66% left the heading 511px — one line at 1280, two from 1440 up. */}
      <Container className="relative py-[var(--surge-space-5)]">
        <div className="flex flex-col gap-[var(--surge-space-5)] lg:w-[70%] lg:flex-row lg:items-center lg:gap-[var(--surge-space-7)] xl:gap-[var(--surge-space-8)]">
          <div className="lg:min-w-0 lg:flex-1">
            <Heading as="h2" size="h2" id={headingId} className="text-[var(--surge-ink)]">
              {title}
            </Heading>
            {sub ? (
              <p className="mt-3 text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{sub}</p>
            ) : null}
          </div>
          <Link href={href} className={btnPrimary + " self-start lg:flex-none lg:self-center"}>
            {cta} <ArrowRight />
          </Link>
        </div>
      </Container>
    </section>
  );
}
