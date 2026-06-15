"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Section = { key: string; label: string; content: ReactNode };

export function SettingsTabs({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections.length > 0 ? sections[0].key : "");

  return (
    <div className="md:flex md:gap-8 md:items-start">
      {/* Mobile: horizontal scrolling tabs (no awkward wrap) */}
      <div className="md:hidden flex gap-1 overflow-x-auto border-b border-line mb-6 -mx-1 px-1">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={
              "shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (active === s.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop: vertical sub-nav */}
      <nav className="hidden md:flex md:w-48 md:shrink-0 md:flex-col gap-0.5 md:sticky md:top-6">
        {sections.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={
                "relative text-left text-sm rounded-md px-3 py-2 transition-colors " +
                (isActive
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
              }
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
              )}
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0">
        {sections.map((s) => (
          <div key={s.key} className={active === s.key ? "" : "hidden"}>
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
