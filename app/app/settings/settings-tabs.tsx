"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Section = { key: string; label: string; content: ReactNode };

export function SettingsTabs({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections.length > 0 ? sections[0].key : "");

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border mb-6">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (active === s.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      {sections.map((s) => (
        <div key={s.key} className={active === s.key ? "" : "hidden"}>
          {s.content}
        </div>
      ))}
    </div>
  );
}