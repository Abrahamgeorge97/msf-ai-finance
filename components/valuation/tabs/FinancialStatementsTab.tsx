"use client"

import { useState } from "react"
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart,
} from "recharts"
import { MetricCard } from "../shared/MetricCard"
import type { ValuationConfig } from "@/types/valuation"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type Sub = "Income Statement" | "Cash Flow" | "Balance Sheet"
const SUBS: Sub[] = ["Income Statement", "Cash Flow", "Balance Sheet"]

interface Props { config: ValuationConfig }

// ── Format helpers ─────────────────────────────────────────────────────────────

const n0 = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`
const n2 = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
const yoy = (curr: number, prev: number) =>
  prev && prev !== 0 ? ((curr / prev) - 1) * 100 : null

// ── Small table primitives ─────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn(
      "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
      right ? "text-right" : "text-left",
    )}>
      {children}
    </th>
  )
}

function MetricRow({
  label, values, fmt, highlight, subdued, indent,
}: {
  label: string
  values: (number | null)[]
  fmt: (v: number) => string
  highlight?: boolean
  subdued?: boolean
  indent?: boolean
}) {
  return (
    <tr className={cn("border-b border-border/40 hover:bg-muted/20", highlight && "bg-muted/20")}>
      <td className={cn(
        "px-3 py-2 text-xs",
        indent ? "pl-7" : "",
        subdued ? "text-muted-foreground" : "text-foreground",
        highlight && "font-semibold",
      )}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className={cn(
          "px-3 py-2 text-right font-mono text-xs",
          subdued ? "text-muted-foreground" : "text-foreground",
          highlight && "font-semibold",
        )}>
          {v === null || v === undefined ? "—" : fmt(v)}
        </td>
      ))}
    </tr>
  )
}

function GrowthRow({ label, values }: { label: string; values: number[] }) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20">
      <td className="px-3 py-2 text-xs text-muted-foreground pl-7">{label}</td>
      {values.map((v, i) => {
        const g = i > 0 ? yoy(v, values[i - 1]) : null
        return (
          <td key={i} className={cn(
            "px-3 py-2 text-right font-mono text-xs",
            g === null ? "text-muted-foreground" : g >= 0 ? "text-green-400" : "text-red-400",
          )}>
            {g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`}
          </td>
        )
      })}
    </tr>
  )
}

function MarginRow({ label, nums, denoms, colorClass = "text-blue-300" }: {
  label: string; nums: number[]; denoms: number[]; colorClass?: string
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20">
      <td className="px-3 py-2 text-xs text-muted-foreground pl-7">{label}</td>
      {nums.map((num, i) => {
        const d = denoms[i]
        const m = d > 0 ? num / d : 0
        return (
          <td key={i} className={`px-3 py-2 text-right font-mono text-xs ${colorClass}`}>
            {pct(m)}
          </td>
        )
      })}
    </tr>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <p className="px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
        {title}
      </p>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FinancialStatementsTab({ config }: Props) {
  const [sub, setSub] = useState<Sub>("Income Statement")
  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-1 border-b border-border px-4 pt-3 pb-0 bg-background overflow-x-auto">
        {SUBS.map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={cn(
              "whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              sub === t
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-6">
        {sub === "Income Statement" && <IncomeStatementSection config={config} />}
        {sub === "Cash Flow"        && <CashFlowSection        config={config} />}
        {sub === "Balance Sheet"    && <BalanceSheetSection    config={config} />}
      </div>
    </div>
  )
}

// ── Income Statement ──────────────────────────────────────────────────────────

function IncomeStatementSection({ config }: { config: ValuationConfig }) {
  const H = config.historical_is
  const B = config.baseline
  const years = H.year.map(String)
  const n = years.length

  // Approximate EBIT: EBITDA minus current D&A (held constant — best available)
  const histEbit = H.ebitda.map((e) => e - B.da_total)

  const chartData = years.map((y, i) => ({
    year: y,
    revenue: H.revenue[i],
    ebitda: H.ebitda[i],
    netIncome: H.net_income[i],
    ebitdaMargin: H.revenue[i] > 0 ? (H.ebitda[i] / H.revenue[i]) * 100 : 0,
    netMargin: H.revenue[i] > 0 ? (H.net_income[i] / H.revenue[i]) * 100 : 0,
  }))

  const prevRev = n >= 2 ? H.revenue[n - 2] : 0
  const prevEPS = n >= 2 ? H.eps[n - 2] : 0
  const revGrowth = yoy(B.revenue, prevRev)
  const epsGrowth = yoy(B.eps, prevEPS)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Revenue"
          value={n0(B.revenue)}
          delta={revGrowth !== null ? `${revGrowth >= 0 ? "+" : ""}${revGrowth.toFixed(1)}% YoY` : undefined}
          deltaPositive={(revGrowth ?? 0) >= 0}
        />
        <MetricCard
          label="EBITDA"
          value={n0(B.ebitda)}
          delta={pct(B.ebitda_margin) + " margin"}
          deltaPositive={B.ebitda_margin > 0.15}
        />
        <MetricCard
          label="Net Income"
          value={n0(B.net_income)}
          delta={B.revenue > 0 ? pct(B.net_income / B.revenue) + " NM" : undefined}
          deltaPositive={B.net_income > 0}
        />
        <MetricCard
          label="EPS (Diluted)"
          value={`$${n2(B.eps)}`}
          delta={epsGrowth !== null ? `${epsGrowth >= 0 ? "+" : ""}${epsGrowth.toFixed(1)}% YoY` : undefined}
          deltaPositive={(epsGrowth ?? 0) >= 0}
        />
      </div>

      {/* Revenue & Margin trend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Revenue, EBITDA & Margins — 5-Year Trend</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number, name: string) =>
                name.includes("Margin")
                  ? [`${v.toFixed(1)}%`, name]
                  : [`$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`, name]
              }
            />
            <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
            <Bar yAxisId="left" dataKey="revenue"   name="Revenue ($M)"  fill="#2563EB" opacity={0.7} radius={[2, 2, 0, 0]} />
            <Bar yAxisId="left" dataKey="ebitda"    name="EBITDA ($M)"   fill="#0D9488" opacity={0.85} radius={[2, 2, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="ebitdaMargin" name="EBITDA Margin %" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="netMargin"    name="Net Margin %"   stroke="#A855F7" strokeWidth={2} dot={{ fill: "#A855F7", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 5-year IS summary table */}
      <SectionCard title="Income Statement Summary ($M)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <Th>Metric</Th>
                {years.map((y) => <Th key={y} right>{y}</Th>)}
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Revenue"           values={H.revenue}     fmt={(v) => n0(v)} highlight />
              <GrowthRow  label="  YoY Growth"     values={H.revenue} />
              <MetricRow label="EBITDA"            values={H.ebitda}      fmt={(v) => n0(v)} />
              <MarginRow  label="  EBITDA Margin"  nums={H.ebitda}        denoms={H.revenue} />
              <MetricRow label="EBIT (est.)"       values={histEbit}      fmt={(v) => n0(v)} subdued />
              <MarginRow  label="  EBIT Margin"    nums={histEbit}        denoms={H.revenue} colorClass="text-muted-foreground" />
              <MetricRow label="Net Income"        values={H.net_income}  fmt={(v) => n0(v)} highlight />
              <MarginRow  label="  Net Margin"     nums={H.net_income}    denoms={H.revenue} colorClass="text-purple-300" />
              <MetricRow label="EPS Diluted ($)"   values={H.eps}         fmt={(v) => `$${v.toFixed(2)}`} />
              <GrowthRow  label="  EPS Growth"     values={H.eps} />
              <MetricRow label="DPS ($)"           values={H.dps}         fmt={(v) => v > 0 ? `$${v.toFixed(2)}` : "—"} subdued />
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border bg-muted/10">
          * EBIT estimated as EBITDA less current-period D&A (${n0(B.da_total)}). Exact per-year D&A not separately stored.
        </p>
      </SectionCard>

      {/* Current period P&L bridge */}
      <SectionCard title={`P&L Waterfall — ${config.fiscal_year} ($ millions)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <Th>Line Item</Th>
                <Th right>Amount ($M)</Th>
                <Th right>% Revenue</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                { label: "Revenue",                  value: B.revenue,          indent: false, bold: true,  negative: false },
                { label: "(–) Cost of Goods Sold",   value: B.cogs,             indent: true,  bold: false, negative: true  },
                { label: "= Gross Profit",           value: B.gross_profit,     indent: false, bold: true,  negative: false },
                { label: "(–) SG&A Expense",         value: B.sga,              indent: true,  bold: false, negative: true  },
                { label: "(–) Depreciation & Amort.",value: B.da_total,         indent: true,  bold: false, negative: true  },
                { label: "= EBIT (Operating Income)",value: B.ebit,             indent: false, bold: true,  negative: false },
                { label: "  (+) D&A (add back)",     value: B.da_total,         indent: true,  bold: false, negative: false, muted: true },
                { label: "  = EBITDA",               value: B.ebitda,           indent: true,  bold: false, negative: false, muted: true },
                { label: "(–) Interest Expense",     value: B.interest_expense, indent: true,  bold: false, negative: true  },
                { label: "= Pretax Income",          value: B.pretax_income,    indent: false, bold: false, negative: false },
                { label: "(–) Income Tax",           value: B.tax,              indent: true,  bold: false, negative: true  },
                { label: "= Net Income",             value: B.net_income,       indent: false, bold: true,  negative: false },
              ].map(({ label, value, indent, bold, negative, muted }) => (
                <tr key={label} className="hover:bg-muted/20">
                  <td className={cn(
                    "px-3 py-2 text-xs",
                    indent ? "pl-7" : "",
                    bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground",
                  )}>
                    {label}
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right font-mono text-xs",
                    negative ? "text-red-400" : bold ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}>
                    {negative
                      ? `($${value.toLocaleString("en-US", { maximumFractionDigits: 0 })})`
                      : `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-blue-300">
                    {B.revenue > 0 ? pct(value / B.revenue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Cash Flow ─────────────────────────────────────────────────────────────────

function CashFlowSection({ config }: { config: ValuationConfig }) {
  const H = config.historical_is
  const B = config.baseline
  const years = H.year.map(String)
  const n = years.length

  const fcf = H.ocf.map((o, i) => o - H.capex[i])
  const currentFCF = B.ocf - B.capex
  const marketCap = B.current_price * B.shares_diluted
  const fcfYield = marketCap > 0 ? currentFCF / marketCap : 0
  const ocfNiRatio = B.net_income !== 0 ? B.ocf / B.net_income : 0
  const fcfConversion = B.net_income !== 0 ? currentFCF / B.net_income : 0
  const fcfMargin = B.revenue > 0 ? currentFCF / B.revenue : 0

  const chartData = years.map((y, i) => ({
    year: y,
    ocf: H.ocf[i],
    capex: -H.capex[i],   // shown as negative bar
    fcf: fcf[i],
  }))

  const prevFCF = n >= 2 ? fcf[n - 2] : 0
  const fcfGrowth = yoy(currentFCF, prevFCF)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Operating CF" value={n0(B.ocf)} deltaPositive={B.ocf > 0} />
        <MetricCard label="CapEx" value={n0(B.capex)} delta={B.revenue > 0 ? pct(B.capex / B.revenue) + " of rev" : undefined} deltaPositive={false} />
        <MetricCard
          label="Free Cash Flow"
          value={n0(currentFCF)}
          delta={fcfGrowth !== null ? `${fcfGrowth >= 0 ? "+" : ""}${fcfGrowth.toFixed(1)}% YoY` : undefined}
          deltaPositive={(fcfGrowth ?? 0) >= 0}
        />
        <MetricCard
          label="FCF Yield"
          value={pct(fcfYield, 2)}
          delta="vs market cap"
          deltaPositive={fcfYield > 0.04}
        />
      </div>

      {/* OCF / CapEx / FCF chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Operating Cash Flow vs CapEx vs FCF ($M)</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number, name: string) => [`$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`, name]}
            />
            <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
            <Bar dataKey="ocf"   name="Operating CF" fill="#22C55E" opacity={0.85} radius={[2, 2, 0, 0]} />
            <Bar dataKey="capex" name="CapEx (–)"     fill="#EF4444" opacity={0.75} radius={[0, 0, 2, 2]} />
            <Line type="monotone" dataKey="fcf" name="FCF" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: "#F59E0B", r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 5-year CF table */}
      <SectionCard title="Cash Flow Summary ($M)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <Th>Metric</Th>
                {years.map((y) => <Th key={y} right>{y}</Th>)}
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Operating Cash Flow (OCF)" values={H.ocf}   fmt={(v) => n0(v)} highlight />
              <MetricRow label="Capital Expenditures"       values={H.capex} fmt={(v) => `($${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })})`} subdued />
              <MetricRow label="Free Cash Flow (FCF)"       values={fcf}     fmt={(v) => n0(v)} highlight />
              <MarginRow  label="  FCF Margin"              nums={fcf}       denoms={H.revenue} colorClass="text-amber-300" />
              <MetricRow label="BVPS ($)"                   values={H.bvps}  fmt={(v) => `$${v.toFixed(2)}`} subdued />
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Cash flow quality metrics */}
      <SectionCard title="Cash Flow Quality Metrics">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <Th>Metric</Th>
                <Th right>Value</Th>
                <Th right>Interpretation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                {
                  label: "OCF / Net Income (Cash Conversion)",
                  value: ocfNiRatio.toFixed(2) + "×",
                  interp: ocfNiRatio > 1.2 ? "Excellent — cash far exceeds accounting earnings"
                    : ocfNiRatio > 0.8 ? "Good — earnings well-backed by cash"
                    : ocfNiRatio > 0.5 ? "Below average — accruals building"
                    : "Poor — low cash quality",
                  positive: ocfNiRatio > 0.8,
                },
                {
                  label: "FCF Conversion (FCF / Net Income)",
                  value: fcfConversion.toFixed(2) + "×",
                  interp: fcfConversion > 0.9 ? "Strong — most earnings convert to free cash"
                    : fcfConversion > 0.6 ? "Adequate"
                    : fcfConversion > 0 ? "Weak — high CapEx intensity"
                    : "Negative FCF",
                  positive: fcfConversion > 0.6,
                },
                {
                  label: "FCF Margin",
                  value: pct(fcfMargin),
                  interp: fcfMargin > 0.20 ? "High — very capital-light business"
                    : fcfMargin > 0.10 ? "Healthy FCF generation"
                    : fcfMargin > 0 ? "Positive but moderate"
                    : "Negative FCF",
                  positive: fcfMargin > 0.10,
                },
                {
                  label: "FCF Yield (FCF / Market Cap)",
                  value: pct(fcfYield, 2),
                  interp: fcfYield > 0.05 ? "Attractive — high cash return"
                    : fcfYield > 0.02 ? "Fair value range"
                    : fcfYield > 0 ? "Low yield — premium valuation"
                    : "Negative",
                  positive: fcfYield > 0.03,
                },
                {
                  label: "CapEx Intensity (CapEx / Revenue)",
                  value: B.revenue > 0 ? pct(B.capex / B.revenue) : "—",
                  interp: B.capex / B.revenue < 0.05 ? "Light CapEx — asset-light model"
                    : B.capex / B.revenue < 0.10 ? "Moderate investment intensity"
                    : "Capital-intensive business",
                  positive: B.capex / B.revenue < 0.08,
                },
                {
                  label: "D&A / Revenue",
                  value: B.revenue > 0 ? pct(B.da_total / B.revenue) : "—",
                  interp: "Non-cash charge; high D&A may indicate prior heavy investment",
                  positive: true,
                },
              ].map(({ label, value, interp, positive }) => (
                <tr key={label} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-foreground">{label}</td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", positive ? "text-green-400" : "text-amber-400")}>
                    {value}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

function BalanceSheetSection({ config }: { config: ValuationConfig }) {
  const H = config.historical_is
  const B = config.baseline
  const years = H.year.map(String)

  const marketCap = B.current_price * B.shares_diluted
  const debtToEquity = B.total_equity > 0 ? B.total_debt / B.total_equity : 0
  const netDebtEbitda = B.ebitda > 0 ? B.net_debt / B.ebitda : 0
  const interestCoverage = B.interest_expense > 0 ? B.ebit / B.interest_expense : 0
  const totalLiabilities = B.total_assets - B.total_equity

  // BVPS chart data
  const bvpsChart = years.map((y, i) => ({ year: y, bvps: H.bvps[i] }))

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Assets"  value={n0(B.total_assets)} />
        <MetricCard
          label="Net Debt"
          value={n0(B.net_debt)}
          delta={netDebtEbitda > 0 ? `${netDebtEbitda.toFixed(1)}× EBITDA` : "Net cash"}
          deltaPositive={B.net_debt < 0}
        />
        <MetricCard
          label="Total Equity"
          value={n0(B.total_equity)}
          delta={`BVPS $${B.bvps.toFixed(2)}`}
          deltaPositive={B.total_equity > 0}
        />
        <MetricCard
          label="Interest Coverage"
          value={interestCoverage > 0 ? `${interestCoverage.toFixed(1)}×` : "N/A"}
          delta="EBIT / Interest"
          deltaPositive={interestCoverage > 3}
        />
      </div>

      {/* Balance sheet snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <SectionCard title={`Assets — ${config.fiscal_year} ($M)`}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/40">
              {[
                { label: "Cash & Equivalents",          value: B.cash,                     bold: false },
                { label: "Goodwill",                    value: B.goodwill,                 bold: false },
                { label: "Other Assets (derived)",      value: B.total_assets - B.cash - B.goodwill, bold: false, muted: true },
                { label: "Total Assets",                value: B.total_assets,             bold: true  },
              ].map(({ label, value, bold, muted }) => (
                <tr key={label} className="hover:bg-muted/20">
                  <td className={cn("px-3 py-2 text-xs", bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground")}>
                    {label}
                  </td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs", bold ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}M
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-blue-300">
                    {B.total_assets > 0 ? pct(value / B.total_assets) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* Liabilities & Equity */}
        <SectionCard title={`Liabilities & Equity — ${config.fiscal_year} ($M)`}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/40">
              {[
                { label: "Total Debt",                    value: B.total_debt,                    bold: false },
                { label: "Net Debt (Debt – Cash)",        value: B.net_debt,                      bold: false },
                { label: "Other Liabilities (derived)",   value: totalLiabilities - B.total_debt, bold: false, muted: true },
                { label: "Total Liabilities",             value: totalLiabilities,                bold: false },
                { label: "Total Equity",                  value: B.total_equity,                  bold: true  },
                { label: "Total Liab. + Equity",          value: B.total_assets,                  bold: true, highlight: true },
              ].map(({ label, value, bold, muted, highlight }) => (
                <tr key={label} className={cn("hover:bg-muted/20", highlight && "bg-muted/30")}>
                  <td className={cn("px-3 py-2 text-xs", bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground")}>
                    {label}
                  </td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs", bold ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {value < 0 ? `($${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })})` : `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-blue-300">
                    {B.total_assets > 0 && value > 0 ? pct(value / B.total_assets) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {/* BVPS trend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Book Value Per Share — Historical Trend</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bvpsChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "BVPS"]}
            />
            <Bar dataKey="bvps" name="BVPS ($)" fill={H.bvps[H.bvps.length - 1] > H.bvps[0] ? "#22C55E" : "#EF4444"} opacity={0.85} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[10px] text-muted-foreground text-center">
          {H.bvps.length >= 2
            ? `BVPS ${H.bvps[H.bvps.length - 1] > H.bvps[0] ? "grew" : "declined"} from $${H.bvps[0].toFixed(2)} (${H.year[0]}) to $${H.bvps[H.bvps.length - 1].toFixed(2)} (${H.year[H.year.length - 1]})`
            : ""}
        </p>
      </div>

      {/* Credit & leverage ratios */}
      <SectionCard title="Credit & Leverage Ratios">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <Th>Ratio</Th>
                <Th right>Value</Th>
                <Th right>Benchmark</Th>
                <Th right>Assessment</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                {
                  label: "Net Debt / EBITDA",
                  value: B.net_debt < 0 ? "Net Cash" : `${netDebtEbitda.toFixed(1)}×`,
                  bench: "< 2.0×",
                  assess: B.net_debt < 0 ? "Net cash position — excellent" : netDebtEbitda < 2 ? "Low leverage — healthy" : netDebtEbitda < 4 ? "Moderate leverage" : "High leverage — monitor",
                  ok: B.net_debt < 0 || netDebtEbitda < 2,
                },
                {
                  label: "Debt / Equity (D/E)",
                  value: B.total_equity > 0 ? `${debtToEquity.toFixed(2)}×` : "N/A",
                  bench: "< 1.0×",
                  assess: debtToEquity < 0.5 ? "Conservatively financed" : debtToEquity < 1.5 ? "Moderate gearing" : "Highly leveraged",
                  ok: debtToEquity < 1.0,
                },
                {
                  label: "Interest Coverage (EBIT / Interest)",
                  value: B.interest_expense > 0 ? `${interestCoverage.toFixed(1)}×` : "N/A",
                  bench: "> 3.0×",
                  assess: interestCoverage > 8 ? "Very strong coverage" : interestCoverage > 3 ? "Adequate coverage" : interestCoverage > 1.5 ? "Thin coverage" : "At risk",
                  ok: interestCoverage > 3 || B.interest_expense === 0,
                },
                {
                  label: "Equity / Assets (Equity Ratio)",
                  value: B.total_assets > 0 ? pct(B.total_equity / B.total_assets) : "N/A",
                  bench: "> 30%",
                  assess: B.total_equity / B.total_assets > 0.5 ? "Strong equity base" : B.total_equity / B.total_assets > 0.3 ? "Adequate equity" : "Thin equity cushion",
                  ok: B.total_equity / B.total_assets > 0.3,
                },
                {
                  label: "Market Cap / Total Debt",
                  value: B.total_debt > 0 ? `${(marketCap / B.total_debt).toFixed(1)}×` : "No debt",
                  bench: "> 2.0×",
                  assess: B.total_debt === 0 ? "Debt-free" : marketCap / B.total_debt > 5 ? "Very low leverage relative to market cap" : marketCap / B.total_debt > 2 ? "Moderate" : "Elevated debt load vs valuation",
                  ok: B.total_debt === 0 || marketCap / B.total_debt > 2,
                },
              ].map(({ label, value, bench, assess, ok }) => (
                <tr key={label} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-foreground">{label}</td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", ok ? "text-green-400" : "text-amber-400")}>{value}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{bench}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{assess}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
