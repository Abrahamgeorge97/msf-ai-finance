"use client"

import { MetricCard } from "../../shared/MetricCard"
import { SensitivityTable } from "../../shared/SensitivityTable"
import { computeWACC, computeJustifiedPB, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

export function PBTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline

  const marketCap = B.current_price * B.shares_diluted
  const { ke } = computeWACC(
    a.rf ?? 0.043, a.beta ?? 1.0, a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045, a.tax_rate ?? B.tax_rate,
    marketCap, B.total_debt,
  )

  const { pps_jpb, justifiedPB } = computeJustifiedPB(B, a, ke)
  const pps_pb = computed.medianPb * B.bvps
  const currentPB = B.current_price > 0 && B.bvps > 0 ? B.current_price / B.bvps : 0

  const vsMarketPB  = B.current_price > 0 && pps_pb  > 0 ? ((pps_pb  / B.current_price) - 1) * 100 : 0
  const vsMarketJPB = B.current_price > 0 && pps_jpb > 0 ? ((pps_jpb / B.current_price) - 1) * 100 : 0

  // Sensitivity: P/B multiple vs BVPS
  const pb_r = [-1, -0.5, 0, 0.5, 1].map((d) => computed.medianPb + d)
  const roe_r = [-0.03, -0.015, 0, 0.015, 0.03].map((d) => B.roe + d)
  const sensData = pb_r.map((pb) =>
    roe_r.map((roe) => {
      const g = Math.min(roe * B.plowback_ratio, ke - 0.001)
      const jpb = ke > g ? (roe - g) / (ke - g) : 0
      // Show peer P/B × BVPS for outer columns, justified for reference
      const implied = pb * B.bvps
      return fmtUsd(implied)
    }),
  )

  const compsArr = Object.entries(config.comps)

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        P = P/B × BVPS&nbsp;&nbsp;|&nbsp;&nbsp;Justified P/B = (ROE − g)/(r − g)
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="BVPS" value={fmtUsd(B.bvps, 2)} />
        <MetricCard label="Current P/B" value={currentPB > 0 ? currentPB.toFixed(2) + "×" : "N/A"} />
        <MetricCard
          label="P/B Value"
          value={fmtUsd(pps_pb, 2)}
          delta={`${vsMarketPB >= 0 ? "+" : ""}${vsMarketPB.toFixed(1)}% vs market`}
          deltaPositive={vsMarketPB >= 0}
        />
        <MetricCard
          label="Justified P/B Value"
          value={pps_jpb > 0 ? fmtUsd(pps_jpb, 2) : "N/A"}
          delta={pps_jpb > 0 ? `${vsMarketJPB >= 0 ? "+" : ""}${vsMarketJPB.toFixed(1)}% vs market` : undefined}
          deltaPositive={vsMarketJPB >= 0}
        />
      </div>

      {/* Justified P/B bridge */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Market P/B vs Justified P/B
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {[
              ["ROE", fmtPct(B.roe)],
              ["Cost of Equity (ke)", fmtPct(ke)],
              ["Plowback (b)", fmtPct(B.plowback_ratio)],
              ["Sustainable Growth (g = ROE × b)", fmtPct(Math.min(B.roe * B.plowback_ratio, ke - 0.001))],
              ["Justified P/B", justifiedPB > 0 ? justifiedPB.toFixed(2) + "×" : "N/A"],
              ["Market P/B (current)", currentPB > 0 ? currentPB.toFixed(2) + "×" : "N/A"],
              ["Peer Median P/B", computed.medianPb.toFixed(2) + "×"],
              ["BVPS", fmtUsd(B.bvps, 2)],
              ["Peer P/B Value", fmtUsd(pps_pb, 2)],
              ["Justified P/B Value", pps_jpb > 0 ? fmtUsd(pps_jpb, 2) : "N/A"],
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
          Peer P/B Comps
        </p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Peer", "P/B", "Implied Value"].map((h) => (
                <th key={h} className="px-4 py-2 text-right text-muted-foreground first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compsArr.map(([name, c]) => (
              <tr key={name} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-foreground font-sans">{name}</td>
                <td className="px-4 py-2 text-right">{c.pb.toFixed(2)}×</td>
                <td className="px-4 py-2 text-right">{fmtUsd(c.pb * B.bvps, 2)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2 font-semibold font-sans">Median</td>
              <td className="px-4 py-2 text-right font-semibold">{computed.medianPb.toFixed(2)}×</td>
              <td className="px-4 py-2 text-right font-bold">{fmtUsd(pps_pb, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sensitivity */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Sensitivity: P/B Multiple vs ROE</p>
        <SensitivityTable
          rowLabels={pb_r.map((v) => v.toFixed(2) + "×")}
          colLabels={roe_r.map(fmtPct)}
          rowHeader="P/B"
          colHeader="ROE"
          data={sensData}
        />
      </div>
    </div>
  )
}
