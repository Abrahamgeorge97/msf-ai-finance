"use client"

import { useMemo } from "react"
import type { ComputedValuations } from "@/lib/valuation/calculations"
import type { HistoricalIS, Baseline } from "@/types/valuation"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfidenceFactors {
  spread: number          // model agreement (0–25): tight spread → high score
  volatility: number      // earnings vol (0–25): low EPS variance → high score
  earningsStability: number // monotonicity of net income (0–25)
  fcfTrend: number        // FCF trajectory from proforma (0–25)
}

export interface ConfidenceResult {
  score: number           // 0–100 composite
  factors: ConfidenceFactors
}

// ── Factor math ───────────────────────────────────────────────────────────────

/** Model agreement: 100 - CV*100 for the 8 model prices, scaled to 0–25 */
function scoreSpread(computed: ComputedValuations): number {
  const prices = [
    computed.pps_fcff, computed.pps_ddm, computed.pps_ebitda,
    computed.pps_rev,  computed.pps_pe,  computed.pps_peg,
    computed.pps_pb,   computed.pps_sotp,
  ].filter((v) => v > 0 && isFinite(v))

  if (prices.length < 2) return 12 // neutral
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  const variance = prices.reduce((a, v) => a + (v - mean) ** 2, 0) / prices.length
  const cv = Math.sqrt(variance) / Math.abs(mean)
  // cv=0 → score=25 ; cv=1 → score=0 ; linear clamp
  return Math.round(Math.max(0, Math.min(25, (1 - cv) * 25)))
}

/** EPS volatility: CV of historical EPS, inverted and scaled to 0–25 */
function scoreVolatility(hist: HistoricalIS): number {
  const eps = hist.eps.filter((v) => isFinite(v) && v !== 0)
  if (eps.length < 2) return 12
  const mean = eps.reduce((a, b) => a + b, 0) / eps.length
  if (mean === 0) return 0
  const variance = eps.reduce((a, v) => a + (v - mean) ** 2, 0) / eps.length
  const cv = Math.sqrt(variance) / Math.abs(mean)
  return Math.round(Math.max(0, Math.min(25, (1 - Math.min(cv, 1)) * 25)))
}

/**
 * Earnings stability: fraction of years where net income grew YoY,
 * scaled to 0–25. Fully monotone rising → 25.
 */
function scoreEarningsStability(hist: HistoricalIS): number {
  const ni = hist.net_income.filter((v) => isFinite(v))
  if (ni.length < 2) return 12
  let ups = 0
  for (let i = 1; i < ni.length; i++) {
    if (ni[i] > ni[i - 1]) ups++
  }
  return Math.round((ups / (ni.length - 1)) * 25)
}

/**
 * FCF trend: use proforma FCFF per year from computeAll.
 * If FCFF grows consistently across projection years → high score.
 * Uses linear regression slope normalized to mean FCF.
 */
function scoreFcfTrend(computed: ComputedValuations): number {
  const fcfs = (computed.proforma ?? []).map((r) => r.fcff).filter((v) => isFinite(v))
  if (fcfs.length < 2) return 12

  const n = fcfs.length
  const xMean = (n - 1) / 2
  const yMean = fcfs.reduce((a, b) => a + b, 0) / n
  const slope =
    fcfs.reduce((acc, y, i) => acc + (i - xMean) * (y - yMean), 0) /
    fcfs.reduce((acc, _, i) => acc + (i - xMean) ** 2, 0)

  const growthRate = yMean !== 0 ? slope / Math.abs(yMean) : 0
  // 10%/yr growth rate → full 25 pts
  const raw = Math.min(1, Math.max(0, growthRate / 0.1))
  return Math.round(raw * 25)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface Inputs {
  computed: ComputedValuations
  historicalIS: HistoricalIS
  baseline: Baseline
}

export function useValuationConfidence({ computed, historicalIS }: Inputs): ConfidenceResult {
  return useMemo(() => {
    const spread            = scoreSpread(computed)
    const volatility        = scoreVolatility(historicalIS)
    const earningsStability = scoreEarningsStability(historicalIS)
    const fcfTrend          = scoreFcfTrend(computed)
    const score             = spread + volatility + earningsStability + fcfTrend

    return {
      score: Math.max(0, Math.min(100, score)),
      factors: { spread, volatility, earningsStability, fcfTrend },
    }
  }, [computed, historicalIS])
}
