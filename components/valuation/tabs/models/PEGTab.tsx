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

export function PEGTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const pegGrowth = computed.epsCAGR > 0 ? computed.epsCAGR : 0.05
  const pps_peg = computed.medianPeg * pegGrowth * 100 * B.adj_eps
  const currentPE = B.current_price > 0 && B.eps > 0 ? B.current_price / B.eps : 0
  const currentPEG = currentPE > 0 && pegGrowth > 0 ? currentPE / (pegGrowth * 100) : 0
  const vsMarket = B.current_price > 0 ? ((pps_peg / B.current_price) - 1) * 100 : 0

  // Sensitivity: PEG ratio vs EPS CAGR
  const peg_r = [-0.4, -0.2, 0, 0.2, 0.4].map((d) => computed.medianPeg + d)
  const g_r   = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => pegGrowth + d)
  const sensData = peg_r.map((peg) =>
    g_r.map((g) => {
      if (g <= 0) return "N/A"
      return fmtUsd(peg * g * 100 * B.adj_eps)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        P = PEG × g × 100 × EPS
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="EPS (TTM)" value={fmtUsd(B.adj_eps, 2)} />
        <MetricCard label="EPS CAGR" value={fmtPct(pegGrowth)} />
        <MetricCard label="Current PEG" value={currentPEG > 0 ? currentPEG.toFixed(2) + "×" : "N/A"} />
        <MetricCard
          label="PEG Value"
          value={fmtUsd(pps_peg, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* Historical EPS CAGR */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          EPS CAGR Calculation
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {[
              ["Historical EPS (oldest)", config.historical_is.eps.length > 0 ? fmtUsd(config.historical_is.eps[0], 2) : "N/A"],
              ["Historical EPS (latest)", config.historical_is.eps.length > 0 ? fmtUsd(config.historical_is.eps[config.historical_is.eps.length - 1], 2) : "N/A"],
              ["Years of History", String(Math.max(config.historical_is.eps.length - 1, 1))],
              ["EPS CAGR", fmtPct(pegGrowth)],
              ["Median Peer PEG", computed.medianPeg.toFixed(2) + "×"],
              ["Implied P/E at PEG", (computed.medianPeg * pegGrowth * 100).toFixed(1) + "×"],
              ["PEG Value", fmtUsd(pps_peg, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Peer PEG table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Peer PEG Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "PEG", "Implied P/E", "Implied Value"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => (
              <tr key={name} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                <td className="px-4 py-2 text-right">{c.peg.toFixed(2)}×</td>
                <td className="px-4 py-2 text-right">{(c.peg * pegGrowth * 100).toFixed(1)}×</td>
                <td className="px-4 py-2 text-right">{fmtUsd(c.peg * pegGrowth * 100 * B.adj_eps, 2)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianPeg.toFixed(2)}×</td>
              <td className="px-4 py-2 text-right">{(computed.medianPeg * pegGrowth * 100).toFixed(1)}×</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_peg, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: PEG Ratio vs EPS CAGR</p>
        <SensitivityTable
          rowLabels={peg_r.map((v) => v.toFixed(2) + "×")}
          colLabels={g_r.map(fmtPct)}
          rowHeader="PEG"
          colHeader="EPS CAGR"
          data={sensData}
        />
      </div>
    </div>
  )
}
