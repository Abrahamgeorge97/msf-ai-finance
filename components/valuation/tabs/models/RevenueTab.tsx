"use client"

import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function RevenueTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const pps_rev = B.shares_diluted
    ? (B.revenue * computed.medianEvRev - B.net_debt) / B.shares_diluted
    : 0
  const ev = B.revenue * computed.medianEvRev
  const vsMarket = B.current_price > 0 ? ((pps_rev / B.current_price) - 1) * 100 : 0
  const currentEvRev = B.revenue > 0
    ? (B.current_price * B.shares_diluted + B.net_debt) / B.revenue
    : 0

  // Sensitivity: EV/Revenue multiple vs revenue growth
  const mult_r = [-0.5, -0.25, 0, 0.25, 0.5].map((d) => computed.medianEvRev + d)
  const g_r    = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => a.yr1_g + d)
  const sensData = mult_r.map((m) =>
    g_r.map((g) => {
      const rev = B.revenue * (1 + g)
      const p = B.shares_diluted ? (rev * m - B.net_debt) / B.shares_diluted : 0
      return fmtUsd(p)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        EV = Revenue × EV/Revenue&nbsp;&nbsp;|&nbsp;&nbsp;Price = (EV − Net Debt) / Shares
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Revenue" value={fmtUsd(B.revenue) + "M"} />
        <MetricCard label="Current EV/Revenue" value={currentEvRev > 0 ? currentEvRev.toFixed(2) + "×" : "N/A"} />
        <MetricCard label="Median Peer EV/Rev" value={computed.medianEvRev.toFixed(2) + "×"} />
        <MetricCard
          label="Implied Price"
          value={fmtUsd(pps_rev, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* EV bridge */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          EV Bridge
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {[
              ["Revenue (LTM)", fmtUsd(B.revenue) + "M"],
              ["Median Peer EV/Revenue", computed.medianEvRev.toFixed(2) + "×"],
              ["Implied Enterprise Value", fmtUsd(ev) + "M"],
              ["Less: Net Debt", `(${fmtUsd(B.net_debt)}M)`],
              ["Equity Value", fmtUsd(ev - B.net_debt) + "M"],
              ["Shares Diluted", B.shares_diluted.toFixed(1) + "M"],
              ["Price / Share", fmtUsd(pps_rev, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Peer comps */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Peer EV/Revenue Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "EV/Revenue", "Implied EV", "Implied Price"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => {
              const impliedEv = B.revenue * c.ev_rev
              const impliedP = B.shares_diluted ? (impliedEv - B.net_debt) / B.shares_diluted : 0
              return (
                <tr key={name} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                  <td className="px-4 py-2 text-right">{c.ev_rev.toFixed(2)}×</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(impliedEv)}M</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(impliedP, 2)}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianEvRev.toFixed(2)}×</td>
              <td className="px-4 py-2 text-right">{fmtUsd(ev)}M</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_rev, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: EV/Revenue Multiple vs Revenue Growth</p>
        <SensitivityTable
          rowLabels={mult_r.map((v) => v.toFixed(2) + "×")}
          colLabels={g_r.map(fmtPct)}
          rowHeader="EV/Rev"
          colHeader="Rev Growth"
          data={sensData}
        />
      </div>
    </div>
  )
}
