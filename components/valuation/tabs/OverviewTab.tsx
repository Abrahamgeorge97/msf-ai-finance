"use client"

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import { MetricCard } from "../shared/MetricCard"
import { ConsensusSignal, SignalBadge } from "../shared/SignalBadge"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

const SEG_COLORS = ["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#CA8A04", "#BE185D"]

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

// ── Data quality heuristics ────────────────────────────────────────────────────
// Each check tests whether a key field came from authoritative XBRL data
// (non-zero, non-fallback) vs a rough industry-average approximation.
function buildQualityFlags(config: ValuationConfig) {
  const B = config.baseline
  const H = config.historical_is
  const rev = B.revenue

  const flags = [
    {
      label: "Revenue (XBRL)",
      ok: rev > 0,
      note: rev > 0 ? "From SEC 10-K filing" : "Missing",
    },
    {
      label: "D&A (XBRL)",
      // If D&A is exactly 3% of revenue it's the fallback estimate, not real data
      ok: B.da_total > 0 && Math.abs(B.da_total / rev - 0.03) > 0.002,
      note:
        B.da_total > 0 && Math.abs(B.da_total / rev - 0.03) > 0.002
          ? "From SEC 10-K filing"
          : "Estimated at 3% of revenue — may be inaccurate for this sector",
    },
    {
      label: "CapEx (XBRL)",
      // If CapEx is exactly 2.5% of revenue it's the fallback estimate
      ok: B.capex > 0 && Math.abs(B.capex / rev - 0.025) > 0.002,
      note:
        B.capex > 0 && Math.abs(B.capex / rev - 0.025) > 0.002
          ? "From SEC 10-K filing"
          : "Estimated at 2.5% of revenue — may differ significantly",
    },
    {
      label: "OCF (XBRL)",
      ok: B.ocf > 0,
      note: B.ocf > 0 ? "From SEC 10-K filing" : "Missing — FCF models less reliable",
    },
    {
      label: "Balance Sheet (XBRL)",
      ok: B.total_debt >= 0 && B.total_equity > 0,
      note: B.total_equity > 0 ? "Debt & equity from SEC filing" : "Equity missing",
    },
    {
      label: "Historical Data (3+ yrs)",
      ok: H.revenue.length >= 3,
      note:
        H.revenue.length >= 3
          ? `${H.revenue.length} years of history`
          : `Only ${H.revenue.length} year(s) — trend analysis limited`,
    },
    {
      label: "Live Peer Comps",
      ok: Object.keys(config.comps ?? {}).length >= 2,
      note:
        Object.keys(config.comps ?? {}).length >= 2
          ? `${Object.keys(config.comps).length} peers loaded`
          : "Fewer than 2 peers — multiples less reliable",
    },
    {
      label: "LTM Financials (10-Q)",
      ok: config.dataFlags?.ltm_available ?? false,
      note: config.dataFlags?.ltm_available
        ? `Data current to ${config.dataFlags.ltm_end_date} (+${config.dataFlags.ltm_quarters_ahead}Q beyond last 10-K)`
        : "Annual 10-K figures used — more recent 10-Q not available or not yet filed",
    },
  ]

  const passed = flags.filter((f) => f.ok).length
  const score = Math.round((passed / flags.length) * 100)
  return { flags, score, passed, total: flags.length }
}

export function OverviewTab({ config, computed }: Props) {
  const { B, historical_is: H, segments: S, overview_metrics: M } = {
    B: config.baseline,
    historical_is: config.historical_is,
    segments: config.segments,
    overview_metrics: config.overview_metrics,
  }
  const { signalRows, finalSignal, buys, holds, sells } = computed
  const quality = buildQualityFlags(config)

  const histData = H.year.map((y, i) => ({
    year: String(y),
    revenue: H.revenue[i],
    ebitda: H.ebitda[i],
    net_income: H.net_income[i],
  }))

  const segData = Object.entries(S).map(([name, s]) => ({ name, value: s.revenue }))

  return (
    <div className="space-y-6 p-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Revenue" value={`$${B.revenue.toLocaleString("en-US")}M`} delta={M.revenue_growth} deltaPositive={M.revenue_growth?.startsWith("+")} />
        <MetricCard label="EBITDA (GAAP)" value={`$${B.ebitda.toLocaleString("en-US")}M`} />
        <MetricCard label="Adj. EBITDA" value={`$${B.adj_ebitda.toLocaleString("en-US")}M`} />
        <MetricCard label="FCF" value={`$${B.fcf.toLocaleString("en-US")}M`} delta={M.fcf_growth} deltaPositive={M.fcf_growth?.startsWith("+")} />
        <MetricCard label="Adj. EPS" value={`$${B.adj_eps.toFixed(2)}`} delta={M.adj_eps_growth} deltaPositive={M.adj_eps_growth?.startsWith("+")} />
      </div>

      {/* Data Quality card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Data Quality Score</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{quality.passed}/{quality.total} checks passed</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              quality.score >= 80 ? "bg-green-500/15 text-green-400" :
              quality.score >= 55 ? "bg-yellow-500/15 text-yellow-400" :
              "bg-red-500/15 text-red-400"
            }`}>
              {quality.score}%
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              quality.score >= 80 ? "bg-green-500" :
              quality.score >= 55 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${quality.score}%` }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {quality.flags.map((flag) => (
            <div key={flag.label} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 shrink-0 text-base leading-none ${flag.ok ? "text-green-400" : "text-yellow-400"}`}>
                {flag.ok ? "✓" : "⚠"}
              </span>
              <div>
                <span className={`font-medium ${flag.ok ? "text-foreground" : "text-yellow-400"}`}>{flag.label}</span>
                <span className="text-muted-foreground ml-1">— {flag.note}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/60 leading-relaxed">
          Source: {config.sources ?? "SEC EDGAR XBRL + Yahoo Finance"}
        </p>
      </div>

      {/* Consensus signal */}
      <ConsensusSignal signal={finalSignal} buys={buys} holds={holds} sells={sells} currentPrice={B.current_price} />

      {/* Signal table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intrinsic Value</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">vs Market</th>
              <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {signalRows.map((row) => (
              <tr key={row.method} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 font-medium text-foreground">{row.method}</td>
                <td className="px-4 py-2 text-right font-mono text-foreground">${row.intrinsicValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className={`px-4 py-2 text-right font-mono text-sm ${parseFloat(row.vsMarket) >= 0 ? "text-buy" : "text-sell"}`}>
                  {row.vsMarket.startsWith("-") ? "" : "+"}{row.vsMarket}
                </td>
                <td className="px-4 py-2 text-center">
                  <SignalBadge signal={row.signal} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & EBITDA trend */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Historical Revenue & EBITDA</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [`$${v.toLocaleString()}M`]}
              />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#2563EB" opacity={0.85} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ebitda" name="EBITDA" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: "#F59E0B", r: 4 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Segment pie */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Segment Mix ({config.fiscal_year})</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={segData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" nameKey="name" paddingAngle={2}>
                {segData.map((_, i) => (
                  <Cell key={i} fill={SEG_COLORS[i % SEG_COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, color: "hsl(var(--foreground))" }}
                formatter={(v: number, name: string) => [`$${v.toLocaleString()}M`, name]}
              />
              <Legend iconType="circle" formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key ratios */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {[
              ["Plowback Ratio", `${(B.plowback_ratio * 100).toFixed(1)}%`, "EBITDA Margin (GAAP)", `${(B.ebitda_margin * 100).toFixed(1)}%`],
              ["Payout Ratio", `${(B.payout_ratio * 100).toFixed(1)}%`, "Adj. EBITDA Margin", `${(B.adj_ebitda_margin * 100).toFixed(1)}%`],
              ["ROE", `${(B.roe * 100).toFixed(1)}%`, "Gross Margin", `${(B.gross_margin * 100).toFixed(1)}%`],
              ["Book Value/Share", `$${B.bvps.toFixed(2)}`, "Debt/Equity", B.total_equity ? `${(B.total_debt / B.total_equity).toFixed(2)}×` : "N/A"],
              ["Total Assets", `$${B.total_assets.toLocaleString("en-US")}M`, "Goodwill", `$${B.goodwill.toLocaleString("en-US")}M`],
            ].map(([m1, v1, m2, v2], i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs">{m1}</td>
                <td className="px-4 py-2 text-right text-foreground text-xs">{v1}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{m2}</td>
                <td className="px-4 py-2 text-right text-foreground text-xs">{v2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
