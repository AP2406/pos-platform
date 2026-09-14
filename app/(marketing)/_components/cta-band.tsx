import Link from "next/link";
import { Container, Heading, btnPrimary, ArrowRight } from "./primitives";
import { ImageSlot, type ImageSlotSpec } from "./image-slot";

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
  image?: ImageSlotSpec;
  id?: string;
}) {
  const headingId = (id ?? "cta") + "-title";
  return (
    <section id={id} aria-labelledby={headingId} className="relative overflow-hidden bg-[var(--surge-warm)]">
      {image ? (
        // Hidden below lg: at 375px there is no room for a bleed and the text
        // would sit on top of it. The band is the ask, not the picture.
        //
        // 38%, not the mockup's ~42%: at 42% the picture's left edge crossed
        // the CTA button on a 1280 viewport. The band's job is the button.
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] lg:block">
          <ImageSlot spec={image} rounded={false} fill />
        </div>
      ) : null}
      <Container className="relative flex flex-col gap-[var(--surge-space-5)] py-[var(--surge-space-7)] lg:flex-row lg:items-center lg:gap-[var(--surge-space-8)] lg:py-[var(--surge-space-8)]">
        <div className="lg:max-w-[46%]">
          <Heading as="h2" size="h2" id={headingId} className="text-[var(--surge-ink)]">
            {title}
          </Heading>
          {sub ? (
            <p className="mt-3 text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{sub}</p>
          ) : null}
        </div>
        <Link href={href} className={btnPrimary + " self-start"}>
          {cta} <ArrowRight />
        </Link>
      </Container>
    </section>
  );
}
