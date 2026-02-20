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

export function OverviewTab({ config, computed }: Props) {
  const { B, historical_is: H, segments: S, overview_metrics: M } = {
    B: config.baseline,
    historical_is: config.historical_is,
    segments: config.segments,
    overview_metrics: config.overview_metrics,
  }
  const { signalRows, finalSignal, buys, holds, sells } = computed

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
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
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
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
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
