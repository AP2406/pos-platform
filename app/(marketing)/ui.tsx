// Shared corporate design primitives for the marketing site.
// Palette: navy #0A2540 / #123456, ink #1A2B3C, body #42566B, faint #7A8CA0,
// line #D9E1EA, surface #F4F7FA, link #1B6DC1, green #1E7B4D.

export function Crumb({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-bold uppercase tracking-[0.05em] text-[#1B6DC1]">{children}</div>;
}

export function Tick() {
  return (
    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] bg-[#1E7B4D]">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" className="h-[11px] w-[11px]"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export const btnPrimary = "rounded-[4px] bg-[#0A2540] px-7 py-3.5 text-[15.5px] font-bold text-white transition-colors hover:bg-[#123456]";
export const btnOutline = "rounded-[4px] border-[1.5px] border-[#0A2540] px-7 py-3.5 text-center text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]";
export const btnWhite = "rounded-[4px] bg-white px-7 py-3.5 text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]";

// THE HERO BAND IS FLAT. It was `linear-gradient(180deg,#F4F7FA,#FFFFFF)` here
// and on five other marketing routes — a tint fading into the white of the
// section below it. Flat #F4F7FA is the top stop, i.e. the colour the band was
// actually trying to be; what the fade was doing was hiding the seam, and the
// seam is already drawn by `border-b border-[#D9E1EA]`. #F4F7FA against the
// white next section is 1.08:1 — a tone difference, which is all a band needs
// when it has a rule under it — and the copy on it measures 14.45:1 (heading),
// 7.04:1 (body) and 4.88:1 (crumb).
// The hex literals are the marketing surface's own convention: these routes
// are deliberately outside the tokenised admin palette and carry no OKLCH
// tokens at all, so a token here would have no system to belong to.
export function PageHero({ crumb, title, sub }: { crumb: string; title: string; sub?: string }) {
  return (
    <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
      <div className="mx-auto max-w-3xl px-6 pb-14 pt-40 text-center">
        <Crumb>{crumb}</Crumb>
        <h1 className="mt-4 text-[40px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[46px]">{title}</h1>
        {sub ? <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#42566B]">{sub}</p> : null}
      </div>
    </section>
  );
}

// THE COMING-SOON PANEL — one component, every page that used to quote a rate.
//
// It replaces `SavingsEstimator`, which was deleted rather than softened. That
// widget took a merchant's real volume and returned an annual dollar figure
// computed from 2.5% + 15¢ — a rate we do not currently offer, on a rail we are
// not yet live on (lib/services/finix.ts is env-gated and returns no merchant in
// live). A calculator is the most concrete kind of claim a site can make, so it
// is the first thing that had to go.
//
// Honest, not hidden: the band is labelled, it names the card brands as a future
// capability in future tense, and it does not carry a price, a date or a
// "join the waitlist" form we have nothing behind. `tone="dark"` is for pages
// whose surrounding sections are already tinted.
const PAY_METHODS = ["Tap", "Chip & swipe", "Apple Pay", "Google Pay", "Interac", "Visa", "Mastercard"];

export function ComingSoonBadge({ children = "Coming soon" }: { children?: React.ReactNode }) {
  // #1B6DC1 on #E8F1FB measures 4.60:1 — over AA's 4.5:1 for the 12.5px this
  // renders at, which is below the large-text threshold, so it needs the full bar.
  return (
    <span className="inline-flex items-center rounded-[3px] bg-[#E8F1FB] px-2.5 py-1 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#1B6DC1]">
      {children}
    </span>
  );
}

export function PaymentsComingSoon({ heading = "Card processing — coming soon", body }: { heading?: string; body?: string }) {
  return (
    <div className="rounded-md border border-[#D9E1EA] bg-white p-6 sm:p-7">
      <ComingSoonBadge />
      <h3 className="mt-3.5 text-lg font-bold text-[#0A2540]">{heading}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">
        {body ?? "Surge is a point-of-sale system today. We are building our own card processing and terminals, and until that is live we do not quote a rate and we do not sell hardware. The POS runs your counter now; payments plug in when they are ready, with no reinstall and no new till."}
      </p>
      <div className="mt-5">
        <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">What it will accept</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {PAY_METHODS.map((m) => (
            <span key={m} className="rounded-[4px] border border-[#D9E1EA] px-3 py-1.5 text-[13px] font-semibold text-[#7A8CA0]">{m}</span>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#7A8CA0]">
        Until then you keep whatever processor you have &mdash; Surge does not require you to switch, and there is nothing to cancel.
      </p>
    </div>
  );
}

export function CtaBand({ title, sub, cta, href = "/book" }: { title: string; sub: string; cta: string; href?: string }) {
  return (
    <section className="bg-[#0A2540] py-20 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-center">
        <div>
          <h2 className="max-w-xl text-[32px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">{title}</h2>
          <p className="mt-4 max-w-xl leading-relaxed text-[#B9C8D8]">{sub}</p>
        </div>
        <a href={href} className={"whitespace-nowrap " + btnWhite}>{cta}</a>
      </div>
    </section>
  );
}
