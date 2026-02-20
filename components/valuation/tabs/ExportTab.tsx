"use client"

import { useState } from "react"
import { Download, FileText, Table2 } from "lucide-react"
import { fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import type { ValuationConfig, Assumptions } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  assumptions: Assumptions
  computed: ComputedValuations
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportTab({ config, assumptions: a, computed }: Props) {
  const [exporting, setExporting] = useState<"docx" | "xlsx" | null>(null)
  const B = config.baseline
  const { signalRows, finalSignal, proforma } = computed
  const hist = config.historical_is
  const dateStr = new Date().toISOString().slice(0, 10)

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExcel = async () => {
    setExporting("xlsx")
    try {
      const XLSX = await import("xlsx")

      const wb = XLSX.utils.book_new()

      // ── Sheet 1: Valuation Summary ─────────────────────────────────────
      const ws1 = XLSX.utils.aoa_to_sheet([
        [`${config.name}  (${config.ticker})  —  Equity Valuation Report`],
        [`Fiscal Year: ${config.fiscal_year}`, "", `Scenario: ${a.scenario}`],
        [`Current Price: ${fmtUsd(B.current_price, 2)}`, "", `Consensus Signal: ${finalSignal}`],
        [],
        ["Method", "Intrinsic Value ($)", "vs Market", "Signal"],
        ...signalRows.map((r) => [
          r.method,
          Number(r.intrinsicValue.toFixed(2)),
          r.vsMarket,
          r.signal,
        ]),
        [],
        ["Peer Medians", "", "", ""],
        ["EV/EBITDA", computed.medianEvm.toFixed(1) + "×", "P/E", computed.medianPE.toFixed(1) + "×"],
        ["EV/Revenue", computed.medianEvRev.toFixed(1) + "×", "P/B", computed.medianPb.toFixed(1) + "×"],
        ["P/CF", computed.medianPcf.toFixed(1) + "×", "PEG", computed.medianPeg.toFixed(2)],
      ])
      XLSX.utils.book_append_sheet(wb, ws1, "Valuation Summary")

      // ── Sheet 2: Pro Forma ─────────────────────────────────────────────
      const ws2 = XLSX.utils.aoa_to_sheet([
        [`${config.name}  —  Pro Forma Income Statement & FCF  (${a.proj_years_n}-Year, $M)`],
        [],
        ["Year", "Revenue", "Gross Profit", "EBITDA", "EBITDA Margin", "EBIT", "Net Income", "EPS", "CapEx", "FCFF", "FCFE"],
        ...proforma.map((r) => [
          r.year,
          r.revenue.toFixed(0),
          r.gross_profit.toFixed(0),
          r.ebitda.toFixed(0),
          (r.ebitda_margin * 100).toFixed(1) + "%",
          r.op_inc.toFixed(0),
          r.net_income.toFixed(0),
          B.shares_diluted > 0 ? (r.net_income / B.shares_diluted).toFixed(2) : "—",
          r.capex.toFixed(0),
          r.fcff.toFixed(0),
          r.fcfe.toFixed(0),
        ]),
      ])
      XLSX.utils.book_append_sheet(wb, ws2, "Pro Forma")

      // ── Sheet 3: Assumptions ───────────────────────────────────────────
      const ws3 = XLSX.utils.aoa_to_sheet([
        ["Active Assumptions", "Value"],
        ["Scenario", a.scenario],
        ["WACC", (a.wacc * 100).toFixed(2) + "%"],
        ["Cost of Equity (Ke — CAPM)", (a.cost_of_equity * 100).toFixed(2) + "%"],
        ["Risk-Free Rate (Rf)", (a.rf * 100).toFixed(2) + "%"],
        ["Equity Risk Premium (ERP)", (a.erp * 100).toFixed(2) + "%"],
        ["Beta (β)", a.beta.toFixed(2)],
        ["Cost of Debt (pre-tax)", (a.cost_of_debt * 100).toFixed(2) + "%"],
        ["Tax Rate", (a.tax_rate * 100).toFixed(1) + "%"],
        ["Year 1 Revenue Growth", (a.yr1_g * 100).toFixed(1) + "%"],
        ["Year 2 Revenue Growth", (a.yr2_g * 100).toFixed(1) + "%"],
        ["Year 3 Revenue Growth", (a.yr3_g * 100).toFixed(1) + "%"],
        ["Long-term Growth", (a.lt_g * 100).toFixed(1) + "%"],
        ["Terminal Growth Rate", (a.terminal_g * 100).toFixed(2) + "%"],
        ["Target EBITDA Margin", (a.target_ebitda_m * 100).toFixed(1) + "%"],
        ["CapEx % Revenue", (a.capex_pct * 100).toFixed(2) + "%"],
        ["Exit EV/EBITDA Multiple", a.exit_mult.toFixed(1) + "×"],
        ["Projection Period", a.proj_years_n + " years"],
        ["H-Model DDM Half-Life", (a.hl ?? 2.5) + " years"],
        [],
        ["Baseline Financials ($M unless stated)", "Value"],
        ["Revenue", B.revenue.toFixed(0)],
        ["Adj. EBITDA", B.adj_ebitda.toFixed(0)],
        ["Net Income", B.net_income.toFixed(0)],
        ["Adj. EPS ($)", B.adj_eps.toFixed(2)],
        ["DPS ($)", B.dps.toFixed(2)],
        ["OCF", B.ocf.toFixed(0)],
        ["CapEx", B.capex.toFixed(0)],
        ["Net Debt", B.net_debt.toFixed(0)],
        ["Total Equity", B.total_equity.toFixed(0)],
        ["BVPS ($)", B.bvps.toFixed(2)],
        ["ROE", (B.roe * 100).toFixed(1) + "%"],
        ["Shares Diluted (M)", B.shares_diluted.toFixed(1)],
        ["Current Price ($)", B.current_price.toFixed(2)],
      ])
      XLSX.utils.book_append_sheet(wb, ws3, "Assumptions")

      // ── Sheet 4: Historical Data ───────────────────────────────────────
      const ws4 = XLSX.utils.aoa_to_sheet([
        [`${config.name}  —  Historical Financial Data  ($M unless stated)`],
        [],
        ["Fiscal Year", "Revenue", "EBITDA", "Net Income", "EPS ($)", "DPS ($)", "OCF", "CapEx", "BVPS ($)"],
        ...hist.year.map((yr, i) => [
          yr,
          hist.revenue[i]?.toFixed(0) ?? "",
          hist.ebitda[i]?.toFixed(0) ?? "",
          hist.net_income[i]?.toFixed(0) ?? "",
          hist.eps[i]?.toFixed(2) ?? "",
          hist.dps[i]?.toFixed(2) ?? "",
          hist.ocf[i]?.toFixed(0) ?? "",
          hist.capex[i]?.toFixed(0) ?? "",
          hist.bvps[i]?.toFixed(2) ?? "",
        ]),
      ])
      XLSX.utils.book_append_sheet(wb, ws4, "Historical Data")

      // ── Sheet 5: Peer Comps ────────────────────────────────────────────
      const ws5 = XLSX.utils.aoa_to_sheet([
        ["Peer Comparable Companies"],
        [],
        ["Company", "EV/EBITDA", "EV/Revenue", "P/E", "P/B", "P/CF", "PEG"],
        ...Object.entries(config.comps).map(([name, m]) => [
          name, m.ev_ebitda, m.ev_rev, m.pe, m.pb, m.pcf ?? "—", m.peg,
        ]),
        [],
        ["Median",
          computed.medianEvm.toFixed(1),
          computed.medianEvRev.toFixed(1),
          computed.medianPE.toFixed(1),
          computed.medianPb.toFixed(1),
          computed.medianPcf.toFixed(1),
          computed.medianPeg.toFixed(2),
        ],
      ])
      XLSX.utils.book_append_sheet(wb, ws5, "Peer Comps")

      const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      triggerDownload(
        new Blob([raw], { type: "application/octet-stream" }),
        `${config.ticker}_valuation_${dateStr}.xlsx`,
      )
    } catch (e) {
      console.error("Excel export error:", e)
      alert("Excel export failed — check the browser console.")
    } finally {
      setExporting(null)
    }
  }

  // ── Word Export ───────────────────────────────────────────────────────────
  const handleWord = async () => {
    setExporting("docx")
    try {
      const {
        Document, Paragraph, TextRun, Table, TableRow, TableCell,
        Packer, HeadingLevel, AlignmentType, WidthType, BorderStyle,
      } = await import("docx")

      const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" }
      const TABLE_BORDERS = {
        top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
        insideHorizontal: BORDER, insideVertical: BORDER,
      }

      const tc = (text: string, bold = false) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(text), bold, size: 18, font: "Calibri" })],
            }),
          ],
          borders: TABLE_BORDERS,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        })

      const signalColor = (s: string) =>
        s === "BUY" ? "16A34A" : s === "SELL" ? "DC2626" : "D97706"

      // Valuation signals table
      const valTable = new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Method", "Intrinsic Value", "vs Market", "Signal"].map((h) => tc(h, true)),
          }),
          ...signalRows.map(
            (r) =>
              new TableRow({
                children: [
                  tc(r.method),
                  tc(fmtUsd(r.intrinsicValue, 2)),
                  tc((parseFloat(r.vsMarket) >= 0 ? "+" : "") + r.vsMarket),
                  tc(r.signal, true),
                ],
              }),
          ),
        ],
      })

      // Assumptions table
      const assumRows: [string, string][] = [
        ["Scenario", a.scenario],
        ["WACC", fmtPct(a.wacc, 2)],
        ["Cost of Equity (Ke)", fmtPct(a.cost_of_equity, 2)],
        ["Risk-Free Rate (Rf)", fmtPct(a.rf, 2)],
        ["Equity Risk Premium", fmtPct(a.erp, 2)],
        ["Beta (β)", a.beta.toFixed(2)],
        ["Terminal Growth Rate", fmtPct(a.terminal_g, 2)],
        ["Growth Y1 / Y2 / Y3", `${fmtPct(a.yr1_g, 1)} / ${fmtPct(a.yr2_g, 1)} / ${fmtPct(a.yr3_g, 1)}`],
        ["Target EBITDA Margin", fmtPct(a.target_ebitda_m, 1)],
        ["Exit EV/EBITDA", `${a.exit_mult.toFixed(1)}×`],
        ["Projection Period", `${a.proj_years_n} years`],
        ["CapEx % Revenue", fmtPct(a.capex_pct, 2)],
      ]
      const assumTable = new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({ tableHeader: true, children: [tc("Parameter", true), tc("Value", true)] }),
          ...assumRows.map(([k, v]) => new TableRow({ children: [tc(k), tc(v)] })),
        ],
      })

      // Pro forma table
      const pfTable = new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Year", "Revenue ($M)", "EBITDA ($M)", "EBITDA Margin", "Net Income ($M)", "FCFF ($M)"].map(
              (h) => tc(h, true),
            ),
          }),
          ...proforma.map(
            (r) =>
              new TableRow({
                children: [
                  tc(String(r.year)),
                  tc(fmtUsd(r.revenue, 0) + "M"),
                  tc(fmtUsd(r.ebitda, 0) + "M"),
                  tc(fmtPct(r.ebitda_margin, 1)),
                  tc(fmtUsd(r.net_income, 0) + "M"),
                  tc(fmtUsd(r.fcff, 0) + "M"),
                ],
              }),
          ),
        ],
      })

      const doc = new Document({
        creator: "MSF AI Finance Terminal",
        title: `${config.name} — Equity Valuation Report`,
        sections: [
          {
            properties: {},
            children: [
              // ── Title block ──────────────────────────────────────────
              new Paragraph({
                children: [
                  new TextRun({ text: config.name, bold: true, size: 56, font: "Calibri" }),
                ],
                alignment: AlignmentType.LEFT,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${config.exchange}: ${config.ticker}  ·  FY ${config.fiscal_year}  ·  ${config.currency}`,
                    size: 24, color: "666666", font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Report generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
                    size: 20, color: "999999", font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),

              // ── Executive Summary ────────────────────────────────────
              new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Consensus Signal:  ", bold: true, size: 22, font: "Calibri" }),
                  new TextRun({
                    text: finalSignal,
                    bold: true, size: 22, font: "Calibri",
                    color: signalColor(finalSignal),
                  }),
                  new TextRun({ text: `   (${computed.buys} BUY · ${computed.holds} HOLD · ${computed.sells} SELL)`, size: 20, font: "Calibri", color: "666666" }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Market Price: ${fmtUsd(B.current_price, 2)}  ·  Shares: ${B.shares_diluted.toFixed(1)}M  ·  Net Debt: ${fmtUsd(B.net_debt, 0)}M  ·  Market Cap: ${fmtUsd(B.current_price * B.shares_diluted, 0)}M`,
                    size: 20, font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Revenue: ${fmtUsd(B.revenue, 0)}M  ·  EBITDA: ${fmtUsd(B.ebitda, 0)}M  ·  Adj. EPS: ${fmtUsd(B.adj_eps, 2)}  ·  BVPS: ${fmtUsd(B.bvps, 2)}  ·  ROE: ${fmtPct(B.roe, 1)}`,
                    size: 20, font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),

              // ── Valuation Summary ────────────────────────────────────
              new Paragraph({ text: "Valuation Summary — 14 Methods", heading: HeadingLevel.HEADING_1 }),
              valTable,
              new Paragraph({ text: "" }),

              // ── Active Assumptions ───────────────────────────────────
              new Paragraph({ text: "Active Assumptions", heading: HeadingLevel.HEADING_1 }),
              assumTable,
              new Paragraph({ text: "" }),

              // ── Pro Forma ────────────────────────────────────────────
              new Paragraph({ text: `Pro Forma Projections (${a.proj_years_n}-Year)`, heading: HeadingLevel.HEADING_1 }),
              pfTable,
              new Paragraph({ text: "" }),

              // ── Disclaimer ───────────────────────────────────────────
              new Paragraph({ text: "Data Sources & Disclaimer", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: config.sources ?? "Fundamentals: SEC EDGAR XBRL API (10-K filings). Market data: Yahoo Finance. Peer multiples: placeholder averages.",
                    size: 18, color: "666666", font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: config.disclaimer ?? "For informational and educational purposes only. Not investment advice. All figures in USD millions unless otherwise stated.",
                    size: 18, color: "999999", font: "Calibri",
                  }),
                ],
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      triggerDownload(blob, `${config.ticker}_valuation_${dateStr}.docx`)
    } catch (e) {
      console.error("Word export error:", e)
      alert("Word export failed — check the browser console.")
    } finally {
      setExporting(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const { signalRows: _, finalSignal: __, proforma: ___ } = computed
  void _, void __, void ___

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download the full valuation report and Excel workbook for <span className="font-semibold text-foreground">{config.name}</span>.
        </p>
      </div>

      {/* Download buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleWord}
          disabled={exporting !== null}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <FileText className="w-4 h-4" />
          {exporting === "docx" ? "Generating…" : "Word Report (.docx)"}
        </button>
        <button
          onClick={handleExcel}
          disabled={exporting !== null}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Table2 className="w-4 h-4" />
          {exporting === "xlsx" ? "Generating…" : "Excel Workbook (.xlsx)"}
        </button>
      </div>

      {/* What's included */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> Word Report
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Executive summary with consensus signal</li>
            <li>All 14 valuation methods + signals</li>
            <li>Active assumptions (WACC, CAPM, growth)</li>
            <li>{a.proj_years_n}-year pro forma projections</li>
            <li>Data sources & disclaimer</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-green-400" /> Excel Workbook
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Valuation summary (all 14 models + medians)</li>
            <li>{a.proj_years_n}-year pro forma (revenue → FCFF)</li>
            <li>Assumptions & baseline financials</li>
            <li>{hist.year.length}-year historical data (XBRL)</li>
            <li>Peer comparable companies</li>
          </ul>
        </div>
      </div>

      {/* Signal summary (preview) */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border">
          Valuation Signals Preview
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
            {computed.signalRows.map((r) => (
              <tr key={r.method} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-sans font-medium text-foreground">{r.method}</td>
                <td className="px-4 py-2 text-right">{fmtUsd(r.intrinsicValue, 2)}</td>
                <td className={`px-4 py-2 text-right ${parseFloat(r.vsMarket) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {r.vsMarket.startsWith("-") ? "" : "+"}{r.vsMarket}
                </td>
                <td className={`px-4 py-2 text-right font-bold ${r.signal === "BUY" ? "text-green-400" : r.signal === "SELL" ? "text-red-400" : "text-yellow-400"}`}>
                  {r.signal}
                </td>
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
