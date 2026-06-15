import * as React from "react"

import { cn } from "@/lib/utils"

/** Designed empty/unfinished state — icon + line + optional action. */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-line bg-card/40 px-6 py-10",
        className
      )}
    >
      {icon && <div className="mb-3 text-muted-foreground/50 [&_svg]:size-7">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
