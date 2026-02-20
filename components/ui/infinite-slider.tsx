"use client"

import { useRef, useEffect } from "react"
import { motion, useMotionValue, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface InfiniteSliderProps {
  children: React.ReactNode
  /** px/second during normal scroll. Default 60 */
  speed?: number
  /** px/second while hovering. Default 20 */
  speedOnHover?: number
  /** Scroll right-to-left (default) or left-to-right */
  reverse?: boolean
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InfiniteSlider({
  children,
  speed = 60,
  speedOnHover = 20,
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const x              = useMotionValue(0)
  const innerRef       = useRef<HTMLDivElement>(null)
  const isHovering     = useRef(false)
  const currentVel     = useRef(speed)   // live interpolated velocity
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    // Honour reduce-motion preference — keep layout, drop animation
    if (prefersReduced) return

    let rafId: number
    let lastTime: number | null = null

    const tick = (time: number) => {
      if (lastTime !== null && innerRef.current) {
        const dt     = (time - lastTime) / 1000          // seconds
        const target = isHovering.current ? speedOnHover : speed

        // Ease velocity toward target (no state, no re-render)
        currentVel.current += (target - currentVel.current) * 0.06

        const half = innerRef.current.scrollWidth / 2    // single-set width
        const dir  = reverse ? 1 : -1
        let next   = x.get() + dir * currentVel.current * dt

        // Seamless wrap at the halfway point
        if (reverse && next >= 0)      next -= half
        if (!reverse && next <= -half) next += half

        x.set(next)   // MotionValue.set() — no React re-render
      }
      lastTime = time
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [speed, speedOnHover, reverse, prefersReduced, x])

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
      onMouseEnter={() => { isHovering.current = true  }}
      onMouseLeave={() => { isHovering.current = false }}
    >
      {/* will-change keeps the layer on the GPU */}
      <motion.div
        ref={innerRef}
        className="flex w-max will-change-transform"
        style={{ x }}
      >
        {/* Primary set */}
        <div className="flex">{children}</div>
        {/* Duplicate — hidden from AT to avoid repetition */}
        <div className="flex" aria-hidden="true">{children}</div>
      </motion.div>
    </div>
  )
}
