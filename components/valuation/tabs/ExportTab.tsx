"use client"

import type { ValuationConfig, Assumptions } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"
import { fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { Download } from "lucide-react"

interface Props {
  config: ValuationConfig
  assumptions: Assumptions
  computed: ComputedValuations
}

export function ExportTab({ config, assumptions: a, computed }: Props) {
  const B = config.baseline
  const { signalRows, finalSignal } = computed

  const rows: [string, string][] = [
    ["Scenario", a.scenario],
    ["WACC", fmtPct(a.wacc)],
    ["Cost of Equity", fmtPct(a.cost_of_equity)],
    ["Terminal Growth", fmtPct(a.terminal_g)],
    ["Exit EV/EBITDA", `${a.exit_mult.toFixed(1)}×`],
    ["Target EBITDA Margin", fmtPct(a.target_ebitda_m)],
    ["CapEx % Revenue", fmtPct(a.capex_pct)],
    ["Growth Y1 / Y2 / Y3", `${fmtPct(a.yr1_g)} / ${fmtPct(a.yr2_g)} / ${fmtPct(a.yr3_g)}`],
    ["Long-term Growth", fmtPct(a.lt_g)],
    ["Projection Period", `${a.proj_years_n} yrs`],
    ["Consensus Signal", finalSignal],
    ["Current Price", fmtUsd(B.current_price, 2)],
  ]

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Export</h2>
        <p className="text-sm text-muted-foreground">Download the full valuation report and workbook.</p>
      </div>

      {/* Download buttons */}
      <div className="flex gap-3">
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          onClick={() => alert("Word export — wire up docx generation")}
        >
          <Download className="w-4 h-4" />
          Word Report (.docx)
        </button>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
          onClick={() => alert("Excel export — wire up xlsx generation")}
        >
          <Download className="w-4 h-4" />
          Excel Workbook (.xlsx)
        </button>
      </div>

      {/* Signal summary */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border">
          Valuation Signals
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Method", "Intrinsic Value", "vs Market", "Signal"].map((h) => (
                <th key={h} className="px-4 py-2 text-xs font-semibold text-muted-foreground text-right first:text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-xs">
            {signalRows.map((r) => (
              <tr key={r.method} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-sans font-medium text-foreground">{r.method}</td>
                <td className="px-4 py-2 text-right">{fmtUsd(r.intrinsicValue, 2)}</td>
                <td className={`px-4 py-2 text-right ${parseFloat(r.vsMarket) >= 0 ? "text-buy" : "text-sell"}`}>
                  {r.vsMarket.startsWith("-") ? "" : "+"}{r.vsMarket}
                </td>
                <td className="px-4 py-2 text-right font-semibold">{r.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assumptions */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border">
          Active Assumptions
        </p>
        <table className="w-full text-sm font-mono">
          <tbody className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <tr key={label} className="hover:bg-muted/20">
                <td className="px-4 py-2 text-xs text-muted-foreground font-sans w-1/2">{label}</td>
                <td className="px-4 py-2 text-xs text-foreground text-right">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config.disclaimer && (
        <p className="text-xs text-muted-foreground">{config.disclaimer}</p>
      )}
    </div>
  )
}
