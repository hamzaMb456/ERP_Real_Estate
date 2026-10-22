"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { buttonVariants } from "@/components/ui/button-variants"
import { useControlRef, type ControlMotion } from "@/lib/use-control-motion"

// Glossy variants lift, sweep their sheen and (primary actions) lean toward the pointer;
// ghost buttons do the same only where gloss.css makes them glossy (table rows, card actions).
// Links stay still.
function motionFor(variant: string, size: string): ControlMotion | false {
  if (variant === "link") return false
  if (variant === "ghost") return { lift: true, shine: true, glossOnly: true }
  const primary = variant === "default" || variant === "destructive"
  return { lift: true, shine: true, magnet: primary && !size.includes("xs") }
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ref,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const setRef = useControlRef<HTMLButtonElement>(ref, motionFor(variant ?? "default", size ?? "default"))

  return (
    <Comp
      ref={setRef}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
