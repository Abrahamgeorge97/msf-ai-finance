"use client"

import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { computeWACC, computeJustifiedPE, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function PETab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const marketCap = B.current_price * B.shares_diluted
  const { ke } = computeWACC(
    a.rf ?? 0.043, a.beta ?? 1.0, a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045, a.tax_rate ?? B.tax_rate,
    marketCap, B.total_debt,
  )

  const { pps_jpe, justifiedPE } = computeJustifiedPE(B, a, ke)
  const pps_pe = computed.medianPE * B.adj_eps
  const currentPE = B.current_price > 0 && B.eps > 0 ? B.current_price / B.eps : 0

  const vsMarketPE  = B.current_price > 0 && pps_pe  > 0 ? ((pps_pe  / B.current_price) - 1) * 100 : 0
  const vsMarketJPE = B.current_price > 0 && pps_jpe > 0 ? ((pps_jpe / B.current_price) - 1) * 100 : 0

  // Sensitivity: P/E multiple vs EPS growth
  const pe_r = [-4, -2, 0, 2, 4].map((d) => computed.medianPE + d)
  const g_r  = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => a.yr1_g + d)
  const sensData = pe_r.map((pe) =>
    g_r.map((g) => {
      const fwdEps = B.adj_eps * (1 + g)
      return fmtUsd(pe * fwdEps)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        P = PE × EPS&nbsp;&nbsp;|&nbsp;&nbsp;Justified P/E = (1−b)/(r−g)
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="EPS (TTM)" value={fmtUsd(B.adj_eps, 2)} />
        <MetricCard label="Current P/E" value={currentPE > 0 ? currentPE.toFixed(1) + "×" : "N/A"} />
        <MetricCard
          label="P/E Value"
          value={fmtUsd(pps_pe, 2)}
          delta={`${vsMarketPE >= 0 ? "+" : ""}${vsMarketPE.toFixed(1)}% vs market`}
          deltaPositive={vsMarketPE >= 0}
        />
        <MetricCard
          label="Justified P/E Value"
          value={fmtUsd(pps_jpe, 2)}
          delta={`${vsMarketJPE >= 0 ? "+" : ""}${vsMarketJPE.toFixed(1)}% vs market`}
          deltaPositive={vsMarketJPE >= 0}
        />
      </div>

      {/* Justified P/E bridge */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Justified P/E Decomposition
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {[
              ["Cost of Equity (ke)", fmtPct(ke)],
              ["ROE", fmtPct(B.roe)],
              ["Plowback (b)", fmtPct(B.plowback_ratio)],
              ["Sustainable Growth (g = ROE × b)", fmtPct(Math.min(B.roe * B.plowback_ratio, ke - 0.001))],
              ["Payout (1−b)", fmtPct(B.payout_ratio)],
              ["Justified P/E", justifiedPE > 0 ? justifiedPE.toFixed(1) + "×" : "N/A"],
              ["Forward EPS", fmtUsd(B.eps * (1 + a.yr1_g), 2)],
              ["Justified P/E Value", fmtUsd(pps_jpe, 2)],
            ].map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs font-sans">{label}</td>
                <td className="px-4 py-2 text-right text-foreground font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Peer comps table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Peer P/E Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "P/E", "Implied Value"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => (
              <tr key={name} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                <td className="px-4 py-2 text-right">{c.pe.toFixed(1)}×</td>
                <td className="px-4 py-2 text-right">{fmtUsd(c.pe * B.adj_eps, 2)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianPE.toFixed(1)}×</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_pe, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: P/E Multiple vs EPS Growth</p>
        <SensitivityTable
          rowLabels={pe_r.map((v) => v.toFixed(1) + "×")}
          colLabels={g_r.map(fmtPct)}
          rowHeader="P/E"
          colHeader="EPS Growth"
          data={sensData}
        />
      </div>
    </div>
  )
}
