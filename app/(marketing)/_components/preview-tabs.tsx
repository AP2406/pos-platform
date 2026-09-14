"use client";

import { useRef, useState, type ReactNode } from "react";

// THE PRODUCT-PREVIEW TABS.
//
// A real WAI-ARIA tabs widget, not four pictures and a decorative underline.
//   * tablist / tab / tabpanel roles with aria-selected and aria-controls;
//   * roving tabindex — one tab stop for the whole rail, which is what makes
//     Tab move PAST the widget instead of through four buttons;
//   * Left/Right move and activate, Home/End jump to the ends;
//   * every panel is in the DOM at all times and inactive ones carry the
//     `hidden` attribute. That is deliberate: with JavaScript off or not yet
//     hydrated the markup still contains all four screens, so the text is in
//     the served HTML for a crawler and for a reader whose script failed —
//     "navigation and article text must work before client-side enhancement".
//
// THE UNDERLINE IS NOT THE STATE. aria-selected carries it for assistive tech
// and the label goes bold as well as blue, so the current tab is not signalled
// by a coloured bar alone.
//
// Motion is --surge-motion (180ms), which prefers-reduced-motion zeroes.

export type PreviewTab = {
  id: string;
  label: string;
  panel: ReactNode;
};

/**
 * `aside` is the heading + copy that sits above the tab rail in the left
 * column of 01-home.jpg. It is a prop rather than a sibling because the rail
 * and the panels have to be in the SAME component (they share `active`) while
 * living in DIFFERENT grid columns — passing the copy in is what lets one
 * component own both cells.
 */
export function PreviewTabs({ tabs, label, aside }: { tabs: PreviewTab[]; label: string; aside?: ReactNode }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(i: number) {
    const next = (i + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    // 38/62 with a 24px gutter, which is about where 01-home.jpg puts the
    // split: the copy column runs to roughly a third of the rail and the device
    // frames fill the whole right-hand side of the band.
    //
    // THE SPLIT STARTS AT `xl`, NOT `lg`. Below 1280 the rail IS the viewport,
    // so a 38% track is 353px at 1024 — narrow enough that the band's intro ran
    // to four lines and the four-item tab rail wrapped onto two rows, while the
    // two device frames shared 524px between them. There is no percentage that
    // fixes that; there is only not splitting the band until the rail is at its
    // full 1240. Below that the copy, the rail and the frames each take the
    // whole width, one under the other.
    <div className="grid items-start gap-[var(--surge-space-5)] xl:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
      <div>
      {aside}
      <div role="tablist" aria-label={label} className="mt-[var(--surge-space-6)] flex flex-wrap gap-[var(--surge-space-6)] border-b border-[var(--surge-on-dark-line)]">
        {tabs.map((t, i) => {
          const selected = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={"tab-" + t.id}
              aria-selected={selected}
              aria-controls={"panel-" + t.id}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                "-mb-px border-b-2 pb-3 text-[length:var(--surge-body)] transition-colors duration-[var(--surge-motion)] " +
                (selected
                  ? "border-[var(--surge-accent)] font-bold text-white"
                  : "border-transparent font-semibold text-[var(--surge-on-dark-muted)] hover:text-white")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      </div>

      <div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={"panel-" + t.id}
          aria-labelledby={"tab-" + t.id}
          hidden={i !== active}
          // tabIndex 0 so a keyboard user can scroll the panel after arrowing
          // to its tab; the APG asks for it whenever the panel has no focusable
          // child of its own, which these illustrative screens do not.
          tabIndex={0}
          className="outline-none"
        >
          {t.panel}
        </div>
      ))}
      </div>
    </div>
  );
}
