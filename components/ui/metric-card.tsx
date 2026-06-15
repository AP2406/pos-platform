import * as React from "react"

import { cn } from "@/lib/utils"

type MetricTone = "default" | "warning" | "danger" | "success"

/**
 * Dashboard/reports metric: quiet label + optional icon, big value, helper line.
 * Set `hero` for the single most important number on a screen (gradient accent).
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
            ? "bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent"
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
