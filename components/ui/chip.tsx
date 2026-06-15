import * as React from "react"

import { cn } from "@/lib/utils"

type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info"

const toneClasses: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-line",
  accent: "bg-primary/15 text-primary ring-primary/30",
  success: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
  danger: "bg-red-500/15 text-red-500 ring-red-500/30",
  info: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
}

const dotColor: Record<ChipTone, string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
}

/**
 * Status pill — available/occupied, "No cashier", payment networks, etc.
 * Use semantic tones for status only, not decoration.
 */
function Chip({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: ChipTone; dot?: boolean }) {
  return (
    <span
      data-slot="chip"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  )
}

export { Chip, type ChipTone }
