import * as React from "react"

import { cn } from "@/lib/utils"

type MetricTone = "default" | "warning" | "danger" | "success"

/**
 * Dashboard/reports metric: quiet label + optional icon, big value, helper line.
 * Set `hero` for the single most important number on a screen (brand accent).
 */
function MetricCard({
  label,
  value,
  hint,
  icon,
  hero = false,
  tone = "default",
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  hero?: boolean
  tone?: MetricTone
  className?: string
}) {
  return (
    <div
      data-slot="metric-card"
      className={cn(
        // Every card shares the same surface + hairline border. The hero is set
        // apart by its accent value, never by a different border.
        "flex flex-col rounded-xl bg-card ring-1 ring-line shadow-elevation p-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && (
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-3 font-bold tabular-nums tracking-tight leading-none",
          hero ? "text-3xl" : "text-2xl",
          hero
            // Flat --brand, where this was a --brand -> --primary sweep clipped
            // to the text. The accent is the point of the hero value, so it
            // keeps the brand blue rather than dropping to --foreground; what
            // goes is the sweep. The old measurement was taken at the sweep's
            // lightest point, which WAS --brand, so the number does not move:
            // 3.40:1 on a white card, 5.27:1 on a dark one. At text-3xl bold
            // this is WCAG large text, floor 3:1.
            ? "text-brand"
            : tone === "warning"
            ? "text-amber-500"
            : tone === "danger"
            ? "text-red-500"
            : tone === "success"
            ? "text-emerald-500"
            : "text-foreground"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export { MetricCard, type MetricTone }
