"use client"

import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { computePCF, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function PCFTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  if (B.ocf <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <p className="text-sm font-medium">P/CF — unavailable</p>
        <p className="text-xs">Operating cash flow (OCF) is zero or not available for this company.</p>
      </div>
    )
  }

  const { pps_pcf, cfoPerShare } = computePCF(B, computed.medianPcf)
  const vsMarket = B.current_price > 0 ? ((pps_pcf / B.current_price) - 1) * 100 : 0
  const currentPCF = cfoPerShare > 0 && B.current_price > 0 ? B.current_price / cfoPerShare : 0

  // Sensitivity: P/CF multiple vs OCF growth
  const pcf_r = [-3, -1.5, 0, 1.5, 3].map((d) => computed.medianPcf + d)
  const g_r   = [-0.04, -0.02, 0, 0.02, 0.04].map((d) => a.yr1_g + d)
  const sensData = pcf_r.map((pcf) =>
    g_r.map((g) => {
      const adjOcf = B.ocf * (1 + g)
      const adjCfoPerShare = B.shares_diluted > 0 ? adjOcf / B.shares_diluted : 0
      return fmtUsd(pcf * adjCfoPerShare)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        P = P/CF × (OCF / Shares)
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="OCF" value={fmtUsd(B.ocf) + "M"} />
        <MetricCard label="CFO / Share" value={fmtUsd(cfoPerShare, 2)} />
        <MetricCard label="Current P/CF" value={currentPCF > 0 ? currentPCF.toFixed(1) + "×" : "N/A"} />
        <MetricCard
          label="P/CF Value"
          value={fmtUsd(pps_pcf, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* Bridge */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          P/CF Calculation
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {[
              ["Operating Cash Flow (OCF)", fmtUsd(B.ocf) + "M"],
              ["Shares Diluted", B.shares_diluted.toFixed(1) + "M"],
              ["CFO per Share", fmtUsd(cfoPerShare, 2)],
              ["Median Peer P/CF", computed.medianPcf.toFixed(1) + "×"],
              ["Implied Price", fmtUsd(pps_pcf, 2)],
              ["vs CapEx", `CapEx: ${fmtUsd(B.capex)}M (${B.revenue > 0 ? fmtPct(B.capex / B.revenue) : "N/A"} of Rev)`],
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
          Peer P/CF Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "P/CF", "Implied Value"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => {
              const pcf = c.pcf ?? 15
              return (
                <tr key={name} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                  <td className="px-4 py-2 text-right">{pcf.toFixed(1)}×</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(pcf * cfoPerShare, 2)}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianPcf.toFixed(1)}×</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_pcf, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: P/CF Multiple vs OCF Growth</p>
        <SensitivityTable
          rowLabels={pcf_r.map((v) => v.toFixed(1) + "×")}
          colLabels={g_r.map(fmtPct)}
          rowHeader="P/CF"
          colHeader="OCF Growth"
          data={sensData}
        />
      </div>
    </div>
  )
}
