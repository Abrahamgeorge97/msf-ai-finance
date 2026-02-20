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

export function EVEBITDATab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const pps_ebitda = B.shares_diluted
    ? (B.adj_ebitda * computed.medianEvm - B.net_debt) / B.shares_diluted
    : 0
  const ev = B.adj_ebitda * computed.medianEvm
  const vsMarket = B.current_price > 0 ? ((pps_ebitda / B.current_price) - 1) * 100 : 0
  const currentEvEbitda = B.adj_ebitda > 0
    ? (B.current_price * B.shares_diluted + B.net_debt) / B.adj_ebitda
    : 0

  // Sensitivity: EV/EBITDA multiple vs EBITDA margin
  const mult_r = [-2, -1, 0, 1, 2].map((d) => computed.medianEvm + d)
  const margin_r = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => a.target_ebitda_m + d)
  const sensData = mult_r.map((m) =>
    margin_r.map((margin) => {
      const adj_ebitda = B.revenue * margin
      const p = B.shares_diluted ? (adj_ebitda * m - B.net_debt) / B.shares_diluted : 0
      return fmtUsd(p)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        EV = EBITDA × EV/EBITDA&nbsp;&nbsp;|&nbsp;&nbsp;Price = (EV − Net Debt) / Shares
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="EBITDA" value={fmtUsd(B.adj_ebitda) + "M"} />
        <MetricCard label="Current EV/EBITDA" value={currentEvEbitda > 0 ? currentEvEbitda.toFixed(1) + "×" : "N/A"} />
        <MetricCard label="Median Peer EV/EBITDA" value={computed.medianEvm.toFixed(1) + "×"} />
        <MetricCard
          label="Implied Price"
          value={fmtUsd(pps_ebitda, 2)}
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
              ["EBITDA", fmtUsd(B.adj_ebitda) + "M"],
              ["Median Peer EV/EBITDA", computed.medianEvm.toFixed(1) + "×"],
              ["Implied Enterprise Value", fmtUsd(ev) + "M"],
              ["Less: Net Debt", `(${fmtUsd(B.net_debt)}M)`],
              ["Equity Value", fmtUsd(ev - B.net_debt) + "M"],
              ["Shares Diluted", B.shares_diluted.toFixed(1) + "M"],
              ["Price / Share", fmtUsd(pps_ebitda, 2)],
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
          Peer EV/EBITDA Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "EV/EBITDA", "EBITDA Margin", "Implied EV", "Implied Price"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => {
              const impliedEv = B.adj_ebitda * c.ev_ebitda
              const impliedP = B.shares_diluted ? (impliedEv - B.net_debt) / B.shares_diluted : 0
              return (
                <tr key={name} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                  <td className="px-4 py-2 text-right">{c.ev_ebitda.toFixed(1)}×</td>
                  <td className="px-4 py-2 text-right">{fmtPct(a.target_ebitda_m)}</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(impliedEv)}M</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(impliedP, 2)}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianEvm.toFixed(1)}×</td>
              <td className="px-4 py-2 text-right">—</td>
              <td className="px-4 py-2 text-right">{fmtUsd(ev)}M</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_ebitda, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: EV/EBITDA Multiple vs EBITDA Margin</p>
        <SensitivityTable
          rowLabels={mult_r.map((v) => v.toFixed(1) + "×")}
          colLabels={margin_r.map(fmtPct)}
          rowHeader="EV/EBITDA"
          colHeader="EBITDA Margin"
          data={sensData}
        />
      </div>
    </div>
  )
}
