"use client"

import { useState, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { runMonteCarlo, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import type { MonteCarloResults } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
  onComplete?: (results: MonteCarloResults) => void
}

const MODEL_COLORS: Record<string, string> = {
  "FCFF (DCF)":      "#2563EB",
  "EV/EBITDA":       "#DC2626",
  "P/E":             "#EA580C",
  "FCFE (DCF)":      "#0D9488",
  "Residual Income": "#7C3AED",
}

const N_SIMS = 1000
const N_BINS = 24

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0
}

function buildHistogram(values: number[], nBins: number): { bin: string; count: number; lo: number }[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  const step = (hi - lo) / nBins || 1
  const bins = Array.from({ length: nBins }, (_, i) => ({ bin: fmtUsd(lo + i * step, 0), count: 0, lo: lo + i * step }))
  values.forEach((v) => {
    const i = Math.min(Math.floor((v - lo) / step), nBins - 1)
    bins[i].count++
  })
  return bins
}

export function MonteCarloTab({ config, computed, onComplete }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline
  const [results, setResults] = useState<MonteCarloResults | null>(null)
  const [running, setRunning]  = useState(false)
  const [activeModel, setActiveModel] = useState("FCFF (DCF)")

  const runSim = useCallback(() => {
    setRunning(true)
    // Defer to next tick so UI can show "Running…"
    setTimeout(() => {
      const r = runMonteCarlo(B, a, computed.medianEvm, computed.medianPE, N_SIMS)
      setResults(r)
      onComplete?.(r)
      setRunning(false)
    }, 10)
  }, [B, a, computed.medianEvm, computed.medianPE, onComplete])

  const data = results?.[activeModel] ?? []
  const sorted = [...data].sort((a, b) => a - b)
  const p5  = percentile(sorted, 0.05)
  const p25 = percentile(sorted, 0.25)
  const p50 = percentile(sorted, 0.50)
  const p75 = percentile(sorted, 0.75)
  const p95 = percentile(sorted, 0.95)
  const aboveMarket = sorted.filter((v) => v > B.current_price).length
  const probUpside  = sorted.length ? aboveMarket / sorted.length : 0

  const histogram = buildHistogram(data, N_BINS)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        Monte Carlo — samples WACC (σ=1.5%), Year-1 Growth (σ=2%), Target Margin (σ=2.5%) from N({N_SIMS.toLocaleString()}) simulations
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runSim}
          disabled={running}
          className="px-5 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
        >
          {running ? "Running…" : results ? `Re-run (N=${N_SIMS.toLocaleString()})` : `Run Simulation (N=${N_SIMS.toLocaleString()})`}
        </button>

        {/* Model selector */}
        {results && (
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(MODEL_COLORS).map((m) => (
              <button
                key={m}
                onClick={() => setActiveModel(m)}
                style={activeModel === m ? { borderColor: MODEL_COLORS[m], color: MODEL_COLORS[m], background: MODEL_COLORS[m] + "18" } : {}}
                className="px-3 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pre-run placeholder */}
      {!results && !running && (
        <div className="flex items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-lg">
          <p className="text-sm">Click &quot;Run Simulation&quot; to generate Monte Carlo distribution</p>
        </div>
      )}

      {/* Results */}
      {results && data.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="P5"  value={fmtUsd(p5,  2)} />
            <MetricCard label="P25" value={fmtUsd(p25, 2)} />
            <MetricCard label="P50 (Median)" value={fmtUsd(p50, 2)} delta={`${p50 > B.current_price ? "+" : ""}${(((p50 / B.current_price) - 1) * 100).toFixed(1)}% vs market`} deltaPositive={p50 > B.current_price} />
            <MetricCard label="P75" value={fmtUsd(p75, 2)} />
            <MetricCard label="P95" value={fmtUsd(p95, 2)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Simulations" value={data.length.toLocaleString()} />
            <MetricCard label="P(above market)" value={fmtPct(probUpside, 1)} deltaPositive={probUpside > 0.5} />
            <MetricCard label="Market Price" value={fmtUsd(B.current_price, 2)} />
          </div>

          {/* Histogram */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Price Distribution — {activeModel} ({data.length.toLocaleString()} simulations)
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={histogram} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="bin"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  interval={3}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                  formatter={(v: number) => [`${v} paths`, "Count"]}
                />
                <ReferenceLine
                  x={histogram.find((b) => b.lo >= B.current_price)?.bin ?? ""}
                  stroke="#F59E0B"
                  strokeWidth={2}
                  label={{ value: "Market", fill: "#F59E0B", fontSize: 10 }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {histogram.map((entry) => (
                    <Cell
                      key={entry.bin}
                      fill={entry.lo >= B.current_price ? "#22C55E" : "#3B82F6"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Blue = below market · Green = above market · Amber line = current price
            </p>
          </div>

          {/* Percentile table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
              Percentile Summary — {activeModel}
            </p>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">Percentile</th>
                  <th className="px-4 py-2 text-right text-xs text-muted-foreground">Simulated Price</th>
                  <th className="px-4 py-2 text-right text-xs text-muted-foreground">vs Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[["P5 (Bear)", p5], ["P25", p25], ["P50 (Median)", p50], ["P75", p75], ["P95 (Bull)", p95]].map(([label, v]) => {
                  const upside = B.current_price > 0 ? ((Number(v) / B.current_price) - 1) * 100 : 0
                  return (
                    <tr key={String(label)} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                      <td className="px-4 py-2 text-right text-foreground font-semibold">{fmtUsd(Number(v), 2)}</td>
                      <td className={`px-4 py-2 text-right text-xs font-semibold ${upside >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
