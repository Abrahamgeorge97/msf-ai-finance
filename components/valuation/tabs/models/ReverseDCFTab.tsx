"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { computeReverseDCF, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function ReverseDCFTab({ config, computed: _computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const { impliedGrowth, rows, sensitivityData } = computeReverseDCF(B, a)
  const delta    = impliedGrowth - a.yr1_g
  const upside   = impliedGrowth > a.yr1_g

  // Find the X-axis label closest to implied growth for the reference line
  const impliedPct = Math.round(impliedGrowth * 100)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        Reverse DCF — WACC &amp; terminal growth fixed. Solves for Year-1 growth that prices the stock at today&apos;s market price.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Market Price"           value={fmtUsd(B.current_price, 2)} />
        <MetricCard label="Implied Yr1 Growth"     value={fmtPct(impliedGrowth, 2)} />
        <MetricCard label="Your Base Yr1 Growth"   value={fmtPct(a.yr1_g, 2)} />
        <MetricCard
          label="Implied vs Base"
          value={`${delta >= 0 ? "+" : ""}${fmtPct(delta, 2)}`}
          delta={upside ? "market expects more growth than your base" : "market bakes in less growth than your base"}
          deltaPositive={upside}
        />
      </div>

      {/* Key message */}
      <div className={`rounded-lg border p-4 text-sm ${upside ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <p className={upside ? "text-green-300" : "text-amber-300"}>
          <span className="font-semibold">
            {upside
              ? "Market is pricing in higher growth than your base case."
              : "Market is pricing in lower growth than your base case."}
          </span>{" "}
          {upside
            ? `At the current price, the market implies ${fmtPct(impliedGrowth, 2)} Year-1 revenue growth — ${fmtPct(Math.abs(delta), 2)} above your base of ${fmtPct(a.yr1_g, 2)}.`
            : `At the current price, the market implies only ${fmtPct(impliedGrowth, 2)} Year-1 revenue growth — ${fmtPct(Math.abs(delta), 2)} below your base of ${fmtPct(a.yr1_g, 2)}.`}
        </p>
      </div>

      {/* Sensitivity chart: growth → price */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">
          DCF Price vs Year-1 Revenue Growth (WACC = {fmtPct(a.wacc, 2)} fixed)
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sensitivityData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="growth"
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(v: number) => fmtUsd(v, 0)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [fmtUsd(v, 2), "Intrinsic Value"]}
              labelFormatter={(v: number) => `Growth: ${(v * 100).toFixed(1)}%`}
            />
            {/* Market price horizontal line */}
            <ReferenceLine y={B.current_price} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: "Market", fill: "#F59E0B", fontSize: 10, position: "insideTopRight" }} />
            {/* Implied growth vertical line */}
            <ReferenceLine x={impliedPct / 100} stroke="#22C55E" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `Implied ${(impliedPct)}%`, fill: "#22C55E", fontSize: 10, position: "insideTopLeft" }} />
            <Line
              type="monotone"
              dataKey="pps"
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[10px] text-muted-foreground text-center">
          Amber = current market price · Green = implied growth rate crossover
        </p>
      </div>

      {/* Summary table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Reverse DCF Summary
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {rows.map(({ label, value }) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interpretation guide */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">How to interpret</p>
        <ul className="list-disc list-inside space-y-1">
          <li>If <span className="text-green-400">implied growth &gt; your base</span>: the stock is priced for optimism — your model says it&apos;s fair at a lower price (potential SELL signal)</li>
          <li>If <span className="text-amber-400">implied growth &lt; your base</span>: the market is pricing in pessimism — your model sees upside if growth materialises (potential BUY signal)</li>
          <li>WACC and terminal growth are held constant. Change them in the Assumptions Drawer to see how the implied growth shifts.</li>
        </ul>
      </div>
    </div>
  )
}
