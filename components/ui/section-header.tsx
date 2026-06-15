import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Sentence-case section heading with optional description + trailing action.
 * Replaces the tiny grey ALL-CAPS labels used across the app.
 */
function SectionHeader({
  children,
  description,
  action,
  className,
}: {
  children: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mt-8 mb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{children}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { SectionHeader }
