import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        // The single most important CTA per screen: blue→cyan gradient, lifted.
        primary:
          "bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-elevation-sm hover:brightness-110 focus-visible:ring-ring/50",
        // ADDED, not swapped in. `primary` is the register's Charge key and the
        // KDS's Done key and it is a blue→cyan gradient; changing it to reach
        // the admin home would have reached two screens where a wrong button is
        // a wrong sale. So this is a second solid-fill variant, and the two
        // never appear on the same screen.
        //
        // Solid brand rather than a gradient, because a gradient on a 34px
        // control is a texture nobody can see and a hue nobody can name. What
        // makes it read as a key instead of a rectangle is the edge treatment:
        // 1px of light along the top lip, and a drop shadow carried in the
        // button's own hue. Hover lifts it a pixel and brightens; pressed puts
        // it back down and takes 2% off it, which is the fastest way to say
        // "received" without waiting for a round trip.
        brand:
          "bg-primary text-primary-foreground shadow-[var(--btn-brand-shadow)] hover:brightness-[1.06] hover:-translate-y-px hover:shadow-[var(--btn-brand-shadow-hover)] active:not-aria-[haspopup]:translate-y-0 active:scale-[0.98] active:brightness-[0.97]",
        // Its counterpart, and the reason the pair reads as a hierarchy: same
        // height, same radius, same press — but a card surface with a hairline
        // instead of a fill, so it is plainly the other one.
        subtle:
          "bg-card text-foreground ring-1 ring-line shadow-elevation-sm hover:bg-raised hover:ring-line-strong hover:-translate-y-px hover:shadow-elevation-hover active:not-aria-[haspopup]:translate-y-0 active:scale-[0.98]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Tablet/POS tap target — 44px min height.
        touch: "h-11 gap-2 rounded-lg px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4.5",
        "icon-touch": "size-11 rounded-lg [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
