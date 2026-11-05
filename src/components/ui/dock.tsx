"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DockProps {
  className?: string
  /** Label of the highlighted item. When omitted, the dock remembers the last clicked one. */
  activeLabel?: string | null
  items: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick?: () => void
  }[]
}

export default function Dock({ items, className, activeLabel }: DockProps) {
  const [clicked, setClicked] = React.useState<string | null>(null)
  const [hovered, setHovered] = React.useState<number | null>(null)
  const active = activeLabel !== undefined ? activeLabel : clicked

  return (
    <div className={cn("pointer-events-none flex w-full items-center justify-center py-12", className)}>
      <motion.div
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "pointer-events-auto flex items-end gap-2 rounded-3xl px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3",
          "border border-black/15 bg-background/80 shadow-lg backdrop-blur-2xl",
        )}
        style={{ transform: "perspective(600px) rotateX(10deg)" }}
      >
        <TooltipProvider delayDuration={100}>
          {items.map((item, i) => {
            const isActive = active === item.label
            const isHovered = hovered === i

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <motion.div
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    animate={{ scale: isHovered ? 1.2 : 1, rotate: isHovered ? -5 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative flex flex-col items-center"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={cn("relative rounded-2xl transition-colors", isActive && "bg-primary", isHovered && "shadow-lg shadow-primary/20")}
                      onClick={() => {
                        setClicked(item.label)
                        item.onClick?.()
                      }}
                    >
                      <item.icon className={cn("h-6 w-6 transition-colors", isActive ? "text-primary-foreground" : "text-foreground")} />
                      {isHovered && (
                        <motion.span
                          layoutId="glow"
                          className="absolute inset-0 rounded-2xl border border-primary/40"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </Button>

                    {isActive && <motion.div layoutId="dot" className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </motion.div>
    </div>
  )
}
