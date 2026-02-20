"use client"

import {
  ComposedChart, Bar, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { CHART_COLORS } from "@/lib/valuation/presets"
import type { ComputedValuations } from "@/lib/valuation/calculations"
import type { ValuationConfig } from "@/types/valuation"
import { fmtUsd } from "@/lib/valuation/calculations"
import { MetricCard } from "../../shared/MetricCard"

interface FFDataPoint {
  method: string
  low: number
  base: number
  high: number
  color: string
}

// CFA-rebalanced weights — must sum to 1.0
const METHOD_WEIGHTS: Record<string, number> = {
  "FCFF (DCF)":      0.20,
  "FCFE (DCF)":      0.10,
  "Residual Income": 0.10,
  "EBITDA Multiple": 0.12,
  "P/E Multiple":    0.08,
  "Justified P/E":   0.07,
  "Justified P/B":   0.05,
  "P/CF":            0.07,
  "DDM (2-Stage)":   0.03,
  "H-Model DDM":     0.02,
  PEG:               0.03,
  "P/B":             0.03,
  "Revenue Multiple":0.05,
  SOTP:              0.05,
}

const MC_MAP: Record<string, string> = {
  "FCFF (DCF)":      "FCFF (DCF)",
  "FCFE (DCF)":      "FCFE",
  "Residual Income": "RI",
  "DDM (2-Stage)":   "DDM",
  "H-Model DDM":     "HDDM",
  "EBITDA Multiple": "EBITDA",
  "Revenue Multiple":"Revenue",
  "P/E Multiple":    "P/E",
  "Justified P/E":   "JPE",
  "Justified P/B":   "JPB",
  PEG:               "PEG",
  "P/B":             "P/B",
  "P/CF":            "PCF",
}

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
  mcResults?: Record<string, number[]>
}

export function FootballFieldTab({ config, computed, mcResults }: Props) {
  const B = config.baseline

  const {
    pps_fcff, pps_fcfe, pps_ri, pps_ddm, pps_hddm,
    pps_ebitda, pps_rev, pps_pe, pps_jpe, pps_jpb,
    pps_peg, pps_pb, pps_pcf, pps_sotp,
  } = computed

  // Build allMethods — only include non-zero models
  const allMethodsRaw: Record<string, number> = {
    "FCFF (DCF)":      pps_fcff,
    "FCFE (DCF)":      pps_fcfe,
    "Residual Income": pps_ri,
    "EBITDA Multiple": pps_ebitda,
    "P/E Multiple":    pps_pe,
    "Justified P/E":   pps_jpe,
    "Justified P/B":   pps_jpb,
    "P/CF":            pps_pcf,
    "DDM (2-Stage)":   pps_ddm,
    "H-Model DDM":     pps_hddm,
    PEG:               pps_peg,
    "P/B":             pps_pb,
    "Revenue Multiple":pps_rev,
    SOTP:              pps_sotp,
  }

  // Filter out zero/negative values (models with missing data)
  const allMethods = Object.fromEntries(
    Object.entries(allMethodsRaw).filter(([, v]) => v > 0)
  )

  // Re-normalize weights for available models
  const totalWeight = Object.keys(allMethods).reduce(
    (acc, m) => acc + (METHOD_WEIGHTS[m] ?? 0), 0
  )

  const ffData: FFDataPoint[] = Object.entries(allMethods).map(([method, base]) => {
    const mcKey = MC_MAP[method]
    const mcArr = mcKey ? mcResults?.[mcKey] : undefined
    const low  = mcArr?.length ? Math.min(...mcArr.filter((_v, i) => i < mcArr.length * 0.10)) : base * 0.85
    const high = mcArr?.length ? Math.max(...mcArr.filter((_v, i) => i > mcArr.length * 0.90)) : base * 1.15
    return { method, low, base, high, color: CHART_COLORS[method] ?? "#64748b" }
  })

  // Recharts needs: { method, rangeStart, rangeWidth, base }
  const chartData = ffData.map((d) => ({
    method: d.method
      .replace(" Multiple", "").replace(" (DCF)", "")
      .replace(" (2-Stage)", "").replace("Residual ", "RI "),
    base: d.base,
    rangeStart: d.low,
    rangeWidth: d.high - d.low,
    color: d.color,
    low: d.low,
    high: d.high,
  }))

  const normWeight = (m: string) =>
    totalWeight > 0 ? (METHOD_WEIGHTS[m] ?? 0) / totalWeight : 0

  const blended      = Object.entries(allMethods).reduce((acc, [m, v]) => acc + v * normWeight(m), 0)
  const blendedLow   = ffData.reduce((acc, d) => acc + d.low  * normWeight(d.method), 0)
  const blendedHigh  = ffData.reduce((acc, d) => acc + d.high * normWeight(d.method), 0)
  const updown = B.current_price > 0 ? ((blended / B.current_price) - 1) * 100 : 0

  const xMin = Math.min(...ffData.map((d) => d.low))  * 0.80
  const xMax = Math.max(...ffData.map((d) => d.high)) * 1.15

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Blended Low" value={fmtUsd(blendedLow)} />
        <MetricCard
          label="Blended Base"
          value={fmtUsd(blended)}
          delta={`${updown >= 0 ? "+" : ""}${updown.toFixed(1)}% vs market`}
          deltaPositive={updown >= 0}
        />
        <MetricCard label="Blended High" value={fmtUsd(blendedHigh)} />
      </div>

      {/* Football field chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-4 text-sm font-semibold text-foreground">
          Implied Share Price by Method ({ffData.length} active models)
        </p>
        <ResponsiveContainer width="100%" height={Math.max(300, ffData.length * 36)}>
          <ComposedChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 60, left: 120, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              domain={[xMin, xMax]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v) => `$${(v).toFixed(0)}`}
            />
            <YAxis
              type="category"
              dataKey="method"
              tick={{ fill: "hsl(var(--foreground))", fontSize: 10 }}
              width={115}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(value: number, name: string) => [`$${value.toFixed(0)}`, name]}
            />

            {/* Range bars */}
            <Bar dataKey="rangeStart" stackId="ff" fill="transparent" legendType="none" />
            <Bar dataKey="rangeWidth" stackId="ff" radius={[0, 4, 4, 0]} legendType="none">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} opacity={0.30} />
              ))}
            </Bar>

            {/* Current price reference line */}
            {B.current_price > 0 && (
              <ReferenceLine
                x={B.current_price}
                stroke="#EF4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `$${B.current_price.toFixed(0)}`, fill: "#EF4444", fontSize: 11, position: "top" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Method", "Low", "Base Case", "High", "Weight", "vs Current"].map((h) => (
                <th key={h} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right first:text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-xs">
            {ffData.map((d) => {
              const vs = B.current_price > 0 ? ((d.base / B.current_price) - 1) * 100 : 0
              const w  = normWeight(d.method)
              return (
                <tr key={d.method} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-sans font-medium text-sm text-foreground">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: d.color }} />
                    {d.method}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtUsd(d.low)}</td>
                  <td className="px-4 py-2 text-right text-foreground font-semibold">{fmtUsd(d.base)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtUsd(d.high)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{(w * 100).toFixed(1)}%</td>
                  <td className={`px-4 py-2 text-right ${vs >= 0 ? "text-buy" : "text-sell"}`}>
                    {vs >= 0 ? "+" : ""}{vs.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold text-foreground font-sans">Blended</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{fmtUsd(blendedLow)}</td>
              <td className="px-4 py-2 text-right text-foreground font-bold">{fmtUsd(blended)}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{fmtUsd(blendedHigh)}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">100%</td>
              <td className={`px-4 py-2 text-right font-semibold ${updown >= 0 ? "text-buy" : "text-sell"}`}>
                {updown >= 0 ? "+" : ""}{updown.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
