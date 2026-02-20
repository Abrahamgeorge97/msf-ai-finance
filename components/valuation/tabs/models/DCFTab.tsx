"use client"

import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { dcfPrice, fmtUsd, fmtPct, buildProforma, buildGrowthSchedule } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

type TVMethod = "Perpetuity Growth" | "Exit Multiple" | "Average"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations  // used for peer/comp data; DCF recalculates from live assumptions
}

export function DCFTab({ config, computed }: Props) {
  // ── Live assumptions from context — reacts to Base/Bull/Bear toggle ──
  const { assumptions: a } = useScenario()
  const B = config.baseline
  const [tvMethod, setTvMethod] = useState<TVMethod>("Average")

  // Recompute proforma from live scenario assumptions — not the cached computed prop
  const proforma = buildProforma(B, buildGrowthSchedule(a), a)

  const fcffs = proforma.map((r) => r.fcff)
  const lastEbitda = proforma[proforma.length - 1].ebitda

  const tvPerp = a.wacc > a.terminal_g
    ? (fcffs[fcffs.length - 1] * (1 + a.terminal_g)) / (a.wacc - a.terminal_g)
    : 0
  const tvExit = lastEbitda * a.exit_mult
  const tvAvg = (tvPerp + tvExit) / 2
  const tvMap: Record<TVMethod, number> = { "Perpetuity Growth": tvPerp, "Exit Multiple": tvExit, Average: tvAvg }
  const tv = tvMap[tvMethod]

  const { pps, ev, pvFcfs, pvTv } = dcfPrice(fcffs, tv, a.wacc, B.net_debt, B.shares_diluted)
  const vsMarket = B.current_price > 0 ? ((pps / B.current_price) - 1) * 100 : 0

  // Sensitivity: WACC vs Terminal Growth
  const wacc_r = [-0.015, -0.010, -0.005, 0, 0.005, 0.010, 0.015].map((d) => a.wacc + d)
  const tg_r = [-0.010, -0.005, 0, 0.005, 0.010].map((d) => a.terminal_g + d)
  const sensData = wacc_r.map((w) =>
    tg_r.map((tg) => {
      if (w <= tg) return "N/A"
      const tvS = (fcffs[fcffs.length - 1] * (1 + tg)) / (w - tg)
      const { pps: p } = dcfPrice(fcffs, tvS, w, B.net_debt, B.shares_diluted)
      return fmtUsd(p)
    }),
  )

  // Chart data
  const chartData = proforma.map((r) => ({
    year: String(r.year),
    fcff: r.fcff,
    revenue: r.revenue,
  }))

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        FCFF = EBIT × (1 − Tax Rate) + D&amp;A − CapEx
      </p>

      {/* TV method selector */}
      <div className="flex gap-2">
        {(["Perpetuity Growth", "Exit Multiple", "Average"] as TVMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => setTvMethod(m)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              tvMethod === m
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Enterprise Value" value={fmtUsd(ev) + "M"} />
        <MetricCard label="Equity Value" value={fmtUsd(ev - B.net_debt) + "M"} />
        <MetricCard label="Price / Share" value={fmtUsd(pps, 2)} delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`} deltaPositive={vsMarket >= 0} />
        <MetricCard label="Terminal Value" value={fmtUsd(tv) + "M"} />
      </div>

      {/* Bridge */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Component</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["PV of FCFFs", fmtUsd(pvFcfs) + "M"],
              ["PV of Terminal Value", fmtUsd(pvTv) + "M"],
              ["Enterprise Value", fmtUsd(ev) + "M"],
              ["Less: Net Debt", `(${fmtUsd(B.net_debt)}M)`],
              ["Equity Value", fmtUsd(ev - B.net_debt) + "M"],
              ["Price / Share", fmtUsd(pps, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Projection table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          FCFF Projections ({a.proj_years_n} Years)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Year", "Revenue", "EBITDA", "EBITDA Margin", "CapEx", "FCFF"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right text-muted-foreground first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proforma.map((r) => (
                <tr key={r.year} className="hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-foreground font-semibold">{r.year}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.revenue)}M</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.ebitda)}M</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtPct(r.ebitda_margin)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.capex)}M</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${r.fcff >= 0 ? "text-buy" : "text-sell"}`}>
                    {fmtUsd(r.fcff)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FCFF chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">FCFF Trajectory</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [fmtUsd(v) + "M"]}
            />
            <Area type="monotone" dataKey="fcff" name="FCFF" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: WACC vs Terminal Growth</p>
        <SensitivityTable
          rowLabels={wacc_r.map(fmtPct)}
          colLabels={tg_r.map(fmtPct)}
          rowHeader="WACC"
          colHeader="Terminal g"
          data={sensData}
        />
      </div>
    </div>
  )
}
