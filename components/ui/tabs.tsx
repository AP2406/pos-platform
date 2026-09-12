"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Radix rather than a row of buttons, because a tab strip has a keyboard
// contract most hand-rolled ones get wrong: arrow keys move between tabs, Tab
// moves *out* of the strip into the panel, and the roving tabindex has to
// follow. Getting that free is worth the ~60 lines.
//
// The underline treatment (not a pill) is deliberate: these strips sit at the
// top of a Panel whose header already carries a hairline, and a filled pill
// row directly under a filled panel header reads as two competing toolbars.

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // -mb-px so the active tab's 2px underline sits ON the container's
        // hairline rather than a pixel above it.
        "flex items-center gap-1 overflow-x-auto border-b border-line-soft",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "u-tx relative shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-foreground",
        // The underline is a pseudo-element so switching tabs never changes the
        // strip's height (a 2px border on the active one only would).
        "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent",
        "data-[state=active]:after:bg-primary",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
