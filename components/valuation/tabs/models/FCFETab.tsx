"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { computeWACC, computeFCFE, buildProforma, buildGrowthSchedule, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function FCFETab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const proforma = buildProforma(B, buildGrowthSchedule(a), a)

  const marketCap = B.current_price * B.shares_diluted
  const { ke } = computeWACC(
    a.rf ?? 0.043, a.beta ?? 1.0, a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045, a.tax_rate ?? B.tax_rate,
    marketCap, B.total_debt,
  )

  const { pps_fcfe, ev_fcfe, fcfes } = computeFCFE(proforma, B, a, ke)
  const vsMarket = B.current_price > 0 ? ((pps_fcfe / B.current_price) - 1) * 100 : 0

  // Sensitivity: ke vs terminal_g
  const ke_r  = [-0.015, -0.010, -0.005, 0, 0.005, 0.010, 0.015].map((d) => ke + d)
  const tg_r  = [-0.010, -0.005, 0, 0.005, 0.010].map((d) => a.terminal_g + d)
  const sensData = ke_r.map((k) =>
    tg_r.map((tg) => {
      if (k <= tg) return "N/A"
      const tv = (fcfes[fcfes.length - 1] * (1 + tg)) / (k - tg)
      const pvFcfes = fcfes.reduce((acc, f, i) => acc + f / (1 + k) ** (i + 1), 0)
      const pvTv    = tv / (1 + k) ** fcfes.length
      const eq = pvFcfes + pvTv
      const p = B.shares_diluted > 0 ? eq / B.shares_diluted : 0
      return fmtUsd(p)
    }),
  )

  const chartData = proforma.map((r, i) => ({
    year: String(r.year),
    fcfe: fcfes[i] ?? 0,
    fcff: r.fcff,
  }))

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        FCFE = FCFF − Interest × (1 − T) + ΔDebt
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="ke (CAPM)" value={fmtPct(ke)} />
        <MetricCard label="EV (FCFE)" value={fmtUsd(ev_fcfe) + "M"} />
        <MetricCard
          label="Price / Share"
          value={fmtUsd(pps_fcfe, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
        <MetricCard label="OCF" value={fmtUsd(B.ocf) + "M"} />
      </div>

      {/* FCFE vs FCFF bridge */}
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
              ["CapEx (actual)", fmtUsd(B.capex) + "M"],
              ["Net Borrowing", fmtUsd(B.net_borrowing) + "M"],
              ["OCF", fmtUsd(B.ocf) + "M"],
              ["Cost of Equity (ke)", fmtPct(ke)],
              ["Equity Value", fmtUsd(ev_fcfe - B.net_debt) + "M"],
              ["Price / Share", fmtUsd(pps_fcfe, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FCFE projection table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          FCFE Projections ({a.proj_years_n} Years)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Year", "Revenue", "FCFF", "Interest (AT)", "FCFE"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right text-muted-foreground first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proforma.map((r, i) => (
                <tr key={r.year} className="hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-foreground font-semibold">{r.year}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.revenue)}M</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.fcff)}M</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.interest * (1 - (a.tax_rate ?? B.tax_rate)))}M</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${(fcfes[i] ?? 0) >= 0 ? "text-buy" : "text-sell"}`}>
                    {fmtUsd(fcfes[i] ?? 0)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">FCFE vs FCFF Trajectory</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [fmtUsd(v) + "M"]}
            />
            <Area type="monotone" dataKey="fcff" name="FCFF" stroke="#2563EB" fill="#2563EB" fillOpacity={0.10} strokeWidth={2} />
            <Area type="monotone" dataKey="fcfe" name="FCFE" stroke="#0D9488" fill="#0D9488" fillOpacity={0.20} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: ke vs Terminal Growth</p>
        <SensitivityTable
          rowLabels={ke_r.map(fmtPct)}
          colLabels={tg_r.map(fmtPct)}
          rowHeader="ke"
          colHeader="Terminal g"
          data={sensData}
        />
      </div>
    </div>
  )
}
