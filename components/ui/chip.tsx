import * as React from "react"

import { cn } from "@/lib/utils"

type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info"

// Outlined, not filled.
//
// A pastel rectangle behind coloured text is the cheapest thing a UI can do
// with colour: it spends a large, soft area of hue to say one small, precise
// thing, and half a dozen of them on one screen turn a dense page into a bag
// of sweets. The same status reads more expensively as a hairline in the hue
// with the text in the hue and exactly one saturated mark — the dot — inside
// it. Contrast improves too: the text now sits on the card rather than on a
// tint of itself.
const toneClasses: Record<ChipTone, string> = {
  neutral: "text-muted-foreground ring-line-strong",
  accent: "text-primary ring-primary/35",
  success: "text-emerald-600 dark:text-emerald-400 ring-emerald-500/35",
  warning: "text-amber-600 dark:text-amber-400 ring-amber-500/35",
  danger: "text-red-600 dark:text-red-400 ring-red-500/35",
  info: "text-sky-600 dark:text-sky-400 ring-sky-500/35",
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
 *
 * The dot is on by default. It is the chip's only block of saturated colour,
 * and it is what lets the outline and the label sit at 35% and still read as
 * "this one is red" from across a room. Pass `dot={false}` only when the chip
 * already leads with a glyph that carries the same meaning — a direction
 * arrow, say — since two leading marks say it twice.
 */
function Chip({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: ChipTone; dot?: boolean }) {
  return (
    <span
      data-slot="chip"
      className={cn(
        // Tighter than it was (px-2.5 py-1 / 12px) and letterspaced a touch:
        // small, wide and firm reads as a label, where large and soft reads as
        // a button somebody forgot to wire up.
        "inline-flex items-center gap-1.5 rounded-full px-2 py-[3px]",
        "text-[12px] leading-none font-semibold tracking-[0.02em]",
        "ring-1 ring-inset whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("shrink-0 size-[5px] rounded-full", dotColor[tone])}
        />
      )}
      {children}
    </span>
  )
}

export { Chip, type ChipTone }
