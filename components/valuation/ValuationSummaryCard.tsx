"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConfidenceFactors } from "@/hooks/useValuationConfidence"

// ── Types ────────────────────────────────────────────────────────────────────

export type SummarySignal = "BUY" | "HOLD" | "SELL"

export interface ValuationSummaryData {
  intrinsicValue: number    // blended consensus price
  marketPrice: number
  upsidePercent: number     // (intrinsic / market - 1) * 100
  signal: SummarySignal
  confidenceScore: number   // 0–100
  confidenceFactors?: ConfidenceFactors
  breakdown: {
    dcf: number
    multiplesAvg: number
    mcMedian: number | null // null = not yet run
  }
}

// ── Signal logic (per spec) ──────────────────────────────────────────────────
// >15%  → BUY   |   -10% to +15% → HOLD   |   <-10% → SELL

export function deriveSummarySignal(upsidePct: number): SummarySignal {
  if (upsidePct > 15) return "BUY"
  if (upsidePct < -10) return "SELL"
  return "HOLD"
}

// ── Confidence: 100 − (cv * 100), clamped 0–100 ─────────────────────────────
// CV = stdDev / |mean|; tight model spread → high confidence

export function deriveConfidence(values: number[]): number {
  const valid = values.filter((v) => v > 0 && isFinite(v))
  if (valid.length < 2) return 50
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const variance = valid.reduce((a, v) => a + (v - mean) ** 2, 0) / valid.length
  const cv = Math.sqrt(variance) / Math.abs(mean)
  return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)))
}

// ── Sub-components ───────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SummarySignal, {
  label: string
  bg: string
  text: string
  border: string
  Icon: React.ElementType
}> = {
  BUY:  { label: "BUY",  bg: "bg-buy/10",  text: "text-buy",  border: "border-buy/25",  Icon: TrendingUp },
  HOLD: { label: "HOLD", bg: "bg-hold/10", text: "text-hold", border: "border-hold/25", Icon: Minus },
  SELL: { label: "SELL", bg: "bg-sell/10", text: "text-sell", border: "border-sell/25", Icon: TrendingDown },
}

function SignalPill({ signal }: { signal: SummarySignal }) {
  const { label, bg, text, border, Icon } = SIGNAL_CONFIG[signal]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold tracking-wider", bg, text, border)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

function BreakdownRow({
  label,
  value,
  market,
  muted,
}: {
  label: string
  value: number | null
  market: number
  muted?: boolean
}) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground/50 italic">not run</span>
      </div>
    )
  }
  const upside = market > 0 ? ((value / market) - 1) * 100 : 0
  const positive = upside >= 0
  return (
    <div className={cn("flex items-center justify-between py-1.5", muted && "opacity-70")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-foreground">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <span className={cn("font-mono text-xs font-semibold w-14 text-right tabular-nums", positive ? "text-buy" : "text-sell")}>
          {positive ? "+" : ""}{upside.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

const FACTOR_LABELS: { key: keyof ConfidenceFactors; label: string }[] = [
  { key: "spread",            label: "Model Agreement" },
  { key: "volatility",       label: "Low Volatility" },
  { key: "earningsStability", label: "Earnings Stability" },
  { key: "fcfTrend",         label: "FCF Trend" },
]

function ConfidenceBar({ score, factors }: { score: number; factors?: ConfidenceFactors }) {
  const color =
    score >= 70 ? "bg-buy" :
    score >= 40 ? "bg-hold" :
    "bg-sell"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          Model Confidence
          <Info className="w-3 h-3 opacity-50" />
        </span>
        <span className={cn("text-xs font-bold font-mono", score >= 70 ? "text-buy" : score >= 40 ? "text-hold" : "text-sell")}>
          {score}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {factors && (
        <div className="space-y-1 pt-1">
          {FACTOR_LABELS.map(({ key, label }) => {
            const val = factors[key]
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/70 w-28 shrink-0">{label}</span>
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/40 transition-all duration-500"
                    style={{ width: `${(val / 25) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/60 w-4 text-right">{val}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data: ValuationSummaryData
  ticker: string
  className?: string
}

export function ValuationSummaryCard({ data, ticker, className }: Props) {
  const { intrinsicValue, marketPrice, upsidePercent, signal, confidenceScore, confidenceFactors, breakdown } = data
  const positive = upsidePercent >= 0
  const { bg, text, border } = SIGNAL_CONFIG[signal]

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border-2 bg-card px-6 py-5 flex flex-col sm:flex-row gap-6",
        border,
        bg,
        className,
      )}
    >
      {/* Left — primary signal */}
      <div className="flex flex-col justify-between gap-3 min-w-[200px]">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{ticker} — Consensus</p>
          <p className={cn("text-4xl font-bold font-mono tracking-tight", text)}>
            ${intrinsicValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xs text-muted-foreground font-mono">
              Market ${marketPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className={cn("text-sm font-bold font-mono tabular-nums", positive ? "text-buy" : "text-sell")}>
              {positive ? "+" : ""}{upsidePercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <SignalPill signal={signal} />
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-border/60 self-stretch" />
      <div className="block sm:hidden h-px bg-border/60" />

      {/* Middle — breakdown */}
      <div className="flex-1 min-w-[200px]">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Model Breakdown</p>
        <div className="divide-y divide-border/50">
          <BreakdownRow label="DCF (FCFF)" value={breakdown.dcf} market={marketPrice} />
          <BreakdownRow label="Multiples Avg" value={breakdown.multiplesAvg} market={marketPrice} />
          <BreakdownRow label="Monte Carlo Median" value={breakdown.mcMedian} market={marketPrice} muted />
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-border/60 self-stretch" />
      <div className="block sm:hidden h-px bg-border/60" />

      {/* Right — confidence */}
      <div className="flex flex-col justify-center min-w-[160px] gap-3">
        <ConfidenceBar score={confidenceScore} factors={confidenceFactors} />
        <p className="text-xs text-muted-foreground leading-snug">
          4-factor score: model agreement, earnings stability, FCF trend, low volatility.
        </p>
      </div>
    </motion.div>
  )
}
