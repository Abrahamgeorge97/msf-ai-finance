"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { computeWACC, computeRI, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function ResidualIncomeTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const marketCap = B.current_price * B.shares_diluted
  const { ke } = computeWACC(
    a.rf ?? 0.043, a.beta ?? 1.0, a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045, a.tax_rate ?? B.tax_rate,
    marketCap, B.total_debt,
  )

  const { pps_ri, riRows } = computeRI(B, a, ke)

  if (B.eps <= 0 || B.bvps <= 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <p className="text-sm">Residual Income — unavailable (no positive EPS or book value)</p>
      </div>
    )
  }

  const vsMarket = B.current_price > 0 ? ((pps_ri / B.current_price) - 1) * 100 : 0
  const sumPvRi = riRows.reduce((acc, r) => acc + r.pv_ri, 0)

  // Sensitivity: ke vs terminal_g
  const ke_r = [-0.015, -0.010, -0.005, 0, 0.005, 0.010, 0.015].map((d) => ke + d)
  const tg_r = [-0.010, -0.005, 0, 0.005, 0.010].map((d) => a.terminal_g + d)
  const sensData = ke_r.map((k) =>
    tg_r.map((tg) => {
      const { pps_ri: p } = computeRI(B, { ...a, terminal_g: tg, cost_of_equity: k }, k)
      return p > 0 ? fmtUsd(p) : "N/A"
    }),
  )

  const chartData = riRows.map((r) => ({
    year: String(r.year),
    ri: r.ri,
    pv_ri: r.pv_ri,
    bvps: r.bvps_start,
  }))

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        RI_t = EPS_t − k_e × B_{"t−1"}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Book Value / Share" value={fmtUsd(B.bvps, 2)} />
        <MetricCard label="ke (CAPM)" value={fmtPct(ke)} />
        <MetricCard label="ΣPV(RI)" value={fmtUsd(sumPvRi, 2)} />
        <MetricCard
          label="RI Value / Share"
          value={fmtUsd(pps_ri, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* Value bridge */}
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
              ["Current BVPS (B₀)", fmtUsd(B.bvps, 2)],
              ["PV of Residual Income", fmtUsd(sumPvRi, 2)],
              ["PV of Terminal RI", fmtUsd(pps_ri - B.bvps - sumPvRi, 2)],
              ["Intrinsic Value (V₀)", fmtUsd(pps_ri, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RI projection table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Residual Income Projections
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Year", "BVPS Start", "EPS Proj", "Req. Return", "RI", "PV(RI)"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right text-muted-foreground first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {riRows.map((r) => (
                <tr key={r.year} className="hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-foreground font-semibold">{r.year}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.bvps_start, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.eps_proj, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.required_return, 2)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${r.ri >= 0 ? "text-buy" : "text-sell"}`}>
                    {fmtUsd(r.ri, 2)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${r.pv_ri >= 0 ? "text-buy" : "text-sell"}`}>
                    {fmtUsd(r.pv_ri, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Residual Income Trajectory</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
            />
            <Area type="monotone" dataKey="ri" name="RI" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.20} strokeWidth={2} />
            <Area type="monotone" dataKey="pv_ri" name="PV(RI)" stroke="#0D9488" fill="#0D9488" fillOpacity={0.10} strokeWidth={1.5} strokeDasharray="4 2" />
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
