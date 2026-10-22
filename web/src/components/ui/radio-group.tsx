"use client"

import * as React from "react"
import { cn } from "cn"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { canMatchMedia, gsap, gsapTokens, MOTION_QUERIES, useGSAP } from "@/lib/gsap"
import { useControlRef } from "@/lib/use-control-motion"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

// The dot springs in when the item becomes checked (the Indicator mounts it).
function RadioDot() {
  const dot = React.useRef<HTMLSpanElement>(null)
  useGSAP(
    () => {
      const el = dot.current
      if (!el || !canMatchMedia()) return
      const mm = gsap.matchMedia()
      mm.add(MOTION_QUERIES.full, () => {
        gsap.from(el, { scale: 0, duration: gsapTokens.pop.duration, ease: "back.out(2.4)" })
      })
      return () => mm.revert()
    },
    { scope: dot }
  )
  return (
    <span
      ref={dot}
      className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground"
    />
  )
}

function RadioGroupItem({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  const setRef = useControlRef<HTMLButtonElement>(ref, {})
  return (
    <RadioGroupPrimitive.Item
      ref={setRef}
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center"
      >
        <RadioDot />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
