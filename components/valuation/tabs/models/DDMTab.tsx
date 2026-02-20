"use client"

import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import {
  computeWACC, computeHModelDDM,
  buildProforma, buildGrowthSchedule, fmtUsd, fmtPct,
} from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"
import { cn } from "@/lib/utils"

type DDMVariant = "2-Stage" | "H-Model"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function DDMTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline
  const [variant, setVariant] = useState<DDMVariant>("2-Stage")

  if (B.dps <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <p className="text-sm font-medium">DDM — unavailable</p>
        <p className="text-xs">This company does not pay a dividend (DPS = $0). DDM requires dividend-paying stock.</p>
      </div>
    )
  }

  const marketCap = B.current_price * B.shares_diluted
  const { ke } = computeWACC(
    a.rf ?? 0.043, a.beta ?? 1.0, a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045, a.tax_rate ?? B.tax_rate,
    marketCap, B.total_debt,
  )

  const proforma = buildProforma(B, buildGrowthSchedule(a), a)
  const divProj = proforma.map((r) => (B.shares_diluted ? r.dividends / B.shares_diluted : 0))

  // 2-Stage DDM
  const pvDivs = divProj.reduce((acc, d, i) => acc + d / (1 + ke) ** (i + 1), 0)
  const finalDiv = divProj[divProj.length - 1] * (1 + a.terminal_g)
  const tvDdm = ke > a.terminal_g ? finalDiv / (ke - a.terminal_g) : 0
  const pvTvDdm = tvDdm / (1 + ke) ** a.proj_years_n
  const pps_2stage = pvDivs + pvTvDdm

  // H-Model DDM
  const pps_hmodel = computeHModelDDM(B, a, ke)

  const pps = variant === "2-Stage" ? pps_2stage : pps_hmodel
  const vsMarket = B.current_price > 0 ? ((pps / B.current_price) - 1) * 100 : 0

  // Sensitivity: ke vs terminal_g
  const ke_r = [-0.015, -0.010, -0.005, 0, 0.005, 0.010, 0.015].map((d) => ke + d)
  const tg_r = [-0.010, -0.005, 0, 0.005, 0.010].map((d) => a.terminal_g + d)
  const sensData = ke_r.map((k) =>
    tg_r.map((tg) => {
      if (k <= tg) return "N/A"
      const p = variant === "2-Stage"
        ? divProj.reduce((acc, d, i) => acc + d / (1 + k) ** (i + 1), 0) + (divProj[divProj.length - 1] * (1 + tg)) / (k - tg) / (1 + k) ** a.proj_years_n
        : computeHModelDDM(B, { ...a, terminal_g: tg }, k)
      return p > 0 ? fmtUsd(p) : "N/A"
    }),
  )

  const chartData = proforma.map((r, i) => ({
    year: String(r.year),
    dividend: divProj[i] ?? 0,
  }))

  // H-Model decomposition
  const D0 = B.dps
  const gL = a.terminal_g
  const gS = a.yr1_g
  const H = a.hl ?? 2.5
  const gordonComponent = D0 * (1 + gL) / (ke - gL)
  const growthComponent = D0 * H * (gS - gL) / (ke - gL)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        {variant === "2-Stage"
          ? "P₀ = Σ PV(D_t) + PV(TV_n)"
          : "P₀ = D₀(1+g_L)/(r−g_L) + D₀×H×(g_S−g_L)/(r−g_L)"}
      </p>

      {/* Variant toggle */}
      <div className="flex gap-2">
        {(["2-Stage", "H-Model"] as DDMVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors",
              variant === v
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="DPS (TTM)" value={fmtUsd(B.dps, 2)} />
        <MetricCard label="ke (CAPM)" value={fmtPct(ke)} />
        <MetricCard label="Dividend Yield" value={B.current_price > 0 ? fmtPct(B.dps / B.current_price) : "N/A"} />
        <MetricCard
          label="DDM Value"
          value={fmtUsd(pps, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* H-Model decomposition (shown when H-Model selected) */}
      {variant === "H-Model" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
            H-Model Decomposition
          </p>
          <table className="w-full text-sm font-mono">
            <tbody className="divide-y divide-border">
              {[
                ["D₀ (current DPS)", fmtUsd(D0, 2)],
                ["High growth rate (g_S = yr1_g)", fmtPct(gS)],
                ["Long-run growth rate (g_L = terminal_g)", fmtPct(gL)],
                [`H (half-life = ${H} years)`, `${H}y`],
                ["Gordon Growth Component", fmtUsd(gordonComponent, 2)],
                ["Growth Premium Component", fmtUsd(growthComponent, 2)],
                ["Total Value (P₀)", fmtUsd(pps_hmodel, 2)],
              ].map(([label, value]) => (
                <tr key={label} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                  <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dividend projection */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Dividend Projections
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Year", "Revenue", "Net Income", "Dividends (total)", "DPS", "PV(DPS)"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right text-muted-foreground first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proforma.map((r, i) => {
                const d = divProj[i] ?? 0
                const pv = d / (1 + ke) ** (i + 1)
                return (
                  <tr key={r.year} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-foreground font-semibold">{r.year}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.revenue)}M</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.net_income)}M</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(r.dividends)}M</td>
                    <td className="px-3 py-1.5 text-right text-foreground font-semibold">{fmtUsd(d, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsd(pv, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Projected DPS</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "DPS"]}
            />
            <Area type="monotone" dataKey="dividend" name="DPS" stroke="#16A34A" fill="#16A34A" fillOpacity={0.20} strokeWidth={2} />
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
