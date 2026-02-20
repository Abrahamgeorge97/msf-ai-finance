"use client"

import { useMemo } from "react"
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts"
import type { ValuationConfig } from "@/types/valuation"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props { config: ValuationConfig }

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
const f2  = (v: number) => v.toFixed(2)

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── UI primitives ─────────────────────────────────────────────────────────────

function ScoreBadge({
  score, max, label, size = "md",
}: { score: number; max: number; label: string; size?: "sm" | "md" | "lg" }) {
  const ratio = max > 0 ? score / max : 0
  const color = ratio >= 0.7 ? "text-green-400 border-green-500/40 bg-green-500/10"
    : ratio >= 0.4 ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-red-400 border-red-500/40 bg-red-500/10"
  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  }
  return (
    <div className={cn("rounded-lg border font-semibold text-center", color, sizes[size])}>
      <div className="font-mono font-bold">{score}<span className="text-xs font-normal opacity-60"> / {max}</span></div>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">{label}</div>
    </div>
  )
}

function Signal({ pass, label, description, na }: { pass: boolean | null; label: string; description: string; na?: boolean }) {
  const icon = na ? "—" : pass ? "✓" : "✗"
  const color = na ? "text-muted-foreground"
    : pass ? "text-green-400"
    : "text-red-400"
  return (
    <tr className="border-b border-border/40 hover:bg-muted/20">
      <td className={cn("px-3 py-2 text-sm font-mono font-bold w-8 text-center", color)}>{icon}</td>
      <td className="px-3 py-2 text-xs text-foreground">{label}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{description}</td>
      <td className={cn("px-3 py-2 text-right text-xs font-semibold", color)}>
        {na ? "N/A" : pass ? "+1" : "0"}
      </td>
    </tr>
  )
}

function RatioRow({ label, value, weight, contribution }: { label: string; value: string; weight: string; contribution: string }) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/20">
      <td className="px-3 py-2 text-xs text-foreground">{label}</td>
      <td className="px-3 py-2 text-right font-mono text-xs text-foreground">{value}</td>
      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{weight}</td>
      <td className="px-3 py-2 text-right font-mono text-xs text-blue-300">{contribution}</td>
    </tr>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function QualityMeter({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  const color = pct >= 70 ? "#22C55E" : pct >= 40 ? "#F59E0B" : "#EF4444"
  return (
    <div className="w-full">
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
        <span>0</span><span>{max / 2}</span><span>{max}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QualityScoresTab({ config }: Props) {
  const B = config.baseline
  const H = config.historical_is
  const n = H.year.length

  const { fScore, fSignals, fAvailable } = useMemo(() => computePiotroski(B, H, n), [B, H, n])
  const { zScore, zComponents, zZone } = useMemo(() => computeAltman(B), [B])
  const cashQuality = useMemo(() => computeCashFlowQuality(B), [B])
  const dupont = useMemo(() => computeDuPont(B), [B])
  const flags = useMemo(() => computeEarningsFlags(B, H, n), [B, H, n])

  // Overall quality score (0–100)
  const overallScore = useMemo(() => {
    let s = 0, w = 0
    // F-Score component (40% weight): normalize to 0–10
    if (fAvailable > 0) { s += (fScore / fAvailable) * 40; w += 40 }
    // Z-Score component (20% weight): 0=distress, 10=safe
    const zNorm = zZone === "Safe" ? 20 : zZone === "Grey" ? 10 : 0
    s += zNorm; w += 20
    // Cash quality (40% weight): based on OCF/NI
    const cqNorm = cashQuality.ocfNiRatio > 1.2 ? 40 : cashQuality.ocfNiRatio > 0.8 ? 30 : cashQuality.ocfNiRatio > 0.5 ? 15 : 0
    s += cqNorm; w += 40
    return w > 0 ? Math.round((s / w) * 100) : 0
  }, [fScore, fAvailable, zZone, cashQuality.ocfNiRatio])

  const overallLabel = overallScore >= 70 ? "HIGH QUALITY" : overallScore >= 45 ? "MODERATE" : "LOW QUALITY"
  const overallColor = overallScore >= 70 ? "text-green-400" : overallScore >= 45 ? "text-amber-400" : "text-red-400"

  // Radar chart data
  const radarData = [
    { metric: "Profitability", value: clamp(B.net_income > 0 ? 80 : 20, 0, 100) },
    { metric: "Cash Quality",  value: clamp(cashQuality.ocfNiRatio * 60, 0, 100) },
    { metric: "Leverage",      value: clamp(B.net_debt < 0 ? 90 : Math.max(10, 80 - (B.net_debt / Math.max(B.ebitda, 1)) * 15), 0, 100) },
    { metric: "F-Score",       value: fAvailable > 0 ? clamp((fScore / fAvailable) * 100, 0, 100) : 50 },
    { metric: "Z-Score",       value: zZone === "Safe" ? 90 : zZone === "Grey" ? 55 : 20 },
    { metric: "DuPont ROE",    value: clamp(dupont.roe * 300, 0, 100) },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cn("rounded-lg border px-4 py-3 text-center",
          overallScore >= 70 ? "border-green-500/30 bg-green-500/5" : overallScore >= 45 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5"
        )}>
          <p className={cn("text-2xl font-bold font-mono", overallColor)}>{overallScore}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Quality</p>
          <p className={cn("text-xs font-semibold mt-1", overallColor)}>{overallLabel}</p>
        </div>
        <ScoreBadge score={fScore} max={fAvailable} label={`Piotroski F (of ${fAvailable})`} size="md" />
        <div className={cn("rounded-lg border px-3 py-2 text-center",
          zZone === "Safe" ? "text-green-400 border-green-500/40 bg-green-500/10" : zZone === "Grey" ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-red-400 border-red-500/40 bg-red-500/10"
        )}>
          <div className="font-mono font-bold text-lg">{zScore.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Altman Z-Score</div>
          <div className="text-xs font-semibold mt-0.5">{zZone} Zone</div>
        </div>
        <div className={cn("rounded-lg border px-3 py-2 text-center",
          cashQuality.ocfNiRatio > 1 ? "text-green-400 border-green-500/40 bg-green-500/10" : "text-amber-400 border-amber-500/40 bg-amber-500/10"
        )}>
          <div className="font-mono font-bold text-lg">{cashQuality.ocfNiRatio.toFixed(2)}×</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">OCF / Net Income</div>
          <div className="text-xs font-semibold mt-0.5">Cash Quality</div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Quality Profile — Multi-Factor Radar</p>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} outerRadius={90}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Radar name="Quality" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [`${v.toFixed(0)} / 100`, "Score"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Piotroski F-Score ────────────────────────────────────────────────── */}
      <SectionCard
        title={`Piotroski F-Score — ${fScore} / ${fAvailable} (${fAvailable < 9 ? `${9 - fAvailable} signals N/A` : "all 9 signals computed"})`}
        subtitle="9 binary signals across profitability, leverage, and operating efficiency. Higher is better. Standard scale: 0–2 weak, 3–6 neutral, 7–9 strong."
      >
        <QualityMeter score={fScore} max={fAvailable} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signal</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description & Value</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/10">
                <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Profitability Signals
                </td>
              </tr>
              {fSignals.slice(0, 4).map((s) => (
                <Signal key={s.label} {...s} />
              ))}
              <tr className="bg-muted/10">
                <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Leverage & Liquidity Signals
                </td>
              </tr>
              {fSignals.slice(4, 7).map((s) => (
                <Signal key={s.label} {...s} />
              ))}
              <tr className="bg-muted/10">
                <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Operating Efficiency Signals
                </td>
              </tr>
              {fSignals.slice(7).map((s) => (
                <Signal key={s.label} {...s} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border bg-muted/10">
          * Signals requiring balance sheet history (prior-year leverage, current ratio, asset turnover change) marked N/A — historical balance sheet arrays not in XBRL companyfacts summary.
        </p>
      </SectionCard>

      {/* ── Altman Z-Score ──────────────────────────────────────────────────── */}
      <SectionCard
        title={`Altman Z-Score — ${zScore.toFixed(2)} (${zZone} Zone)`}
        subtitle="Bankruptcy-prediction model (Altman 1968, revised 2000). Z > 2.99 = Safe; 1.81–2.99 = Grey Zone; < 1.81 = Distress. X1 (working capital ratio) estimated at 0.10 — current assets/liabilities not in XBRL companyfacts."
      >
        <QualityMeter score={clamp(zScore, 0, 5)} max={5} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Component</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ratio (Xi)</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {zComponents.map((c) => (
                <RatioRow key={c.label} label={c.label} value={c.value} weight={c.weight} contribution={c.contribution} />
              ))}
              <tr className="border-t border-border bg-muted/30 font-semibold">
                <td className="px-3 py-2 text-xs text-foreground font-semibold">Z-Score</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-foreground" colSpan={2} />
                <td className={cn("px-3 py-2 text-right font-mono text-sm font-bold",
                  zZone === "Safe" ? "text-green-400" : zZone === "Grey" ? "text-amber-400" : "text-red-400"
                )}>
                  {zScore.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <div className="flex gap-4 text-xs">
            {[
              { zone: "Safe Zone",   range: "Z > 2.99",      color: "text-green-400",  current: zZone === "Safe" },
              { zone: "Grey Zone",   range: "1.81 – 2.99",   color: "text-amber-400",  current: zZone === "Grey" },
              { zone: "Distress",    range: "Z < 1.81",      color: "text-red-400",    current: zZone === "Distress" },
            ].map(({ zone, range, color, current }) => (
              <div key={zone} className={cn("flex items-center gap-1.5", current ? color : "text-muted-foreground")}>
                <span className={cn("w-2 h-2 rounded-full inline-block", current ? (color === "text-green-400" ? "bg-green-400" : color === "text-amber-400" ? "bg-amber-400" : "bg-red-400") : "bg-border")} />
                <span className={current ? "font-semibold" : ""}>{zone}</span>
                <span className="opacity-60">({range})</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Cash Flow Quality ────────────────────────────────────────────────── */}
      <SectionCard
        title="Cash Flow Quality Analysis"
        subtitle="Earnings backed by actual cash generation are higher quality. Accrual build-up (NI >> OCF) is a common red flag."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {cashQuality.metrics.map(({ label, value, rating, interp, positive }) => (
                <tr key={label} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-foreground">{label}</td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", positive ? "text-green-400" : "text-amber-400")}>{value}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn(
                      "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                      positive ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400",
                    )}>
                      {rating}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{interp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sloan Accrual Ratio visual */}
        <div className="px-4 py-3 border-t border-border bg-muted/10">
          <p className="text-xs font-semibold text-foreground mb-1">Sloan Accrual Ratio</p>
          <p className="text-[10px] text-muted-foreground mb-2">
            (Net Income − OCF) ÷ Total Assets = {cashQuality.sloanRatio > 0 ? "+" : ""}{pct(cashQuality.sloanRatio)}.
            Negative = high quality (cash exceeds accounting income). Positive {">"} 10% = potential earnings inflation.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12 text-right">–20%</span>
            <div className="flex-1 h-3 bg-border rounded-full overflow-hidden relative">
              {/* Center line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/40" />
              {/* Indicator */}
              <div
                className={cn("absolute top-0 h-full w-3 rounded-full",
                  cashQuality.sloanRatio < -0.05 ? "bg-green-400" : cashQuality.sloanRatio < 0.05 ? "bg-amber-400" : "bg-red-400"
                )}
                style={{ left: `${clamp(50 + cashQuality.sloanRatio * 250, 2, 96)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-12">+20%</span>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5 px-14">
            <span className="text-green-400">◄ High quality</span>
            <span className="text-red-400">Low quality ►</span>
          </div>
        </div>
      </SectionCard>

      {/* ── DuPont Analysis ───────────────────────────────────────────────────── */}
      <SectionCard
        title="DuPont ROE Decomposition"
        subtitle="ROE = Net Profit Margin × Asset Turnover × Equity Multiplier (Financial Leverage). Identifies the driver of returns."
      >
        <div className="p-4 space-y-4">
          {/* Visual equation */}
          <div className="flex flex-wrap items-center gap-2 text-sm font-mono justify-center">
            <div className="rounded-lg border border-border px-3 py-2 text-center bg-muted/20">
              <div className="text-xs text-muted-foreground">ROE</div>
              <div className={cn("text-lg font-bold", dupont.roe > 0.15 ? "text-green-400" : dupont.roe > 0 ? "text-amber-400" : "text-red-400")}>
                {pct(dupont.roe)}
              </div>
            </div>
            <span className="text-muted-foreground text-lg">=</span>
            <div className="rounded-lg border border-blue-500/30 px-3 py-2 text-center bg-blue-500/5">
              <div className="text-xs text-muted-foreground">Net Margin</div>
              <div className="text-lg font-bold text-blue-400">{pct(dupont.netMargin)}</div>
            </div>
            <span className="text-muted-foreground text-lg">×</span>
            <div className="rounded-lg border border-purple-500/30 px-3 py-2 text-center bg-purple-500/5">
              <div className="text-xs text-muted-foreground">Asset Turnover</div>
              <div className="text-lg font-bold text-purple-400">{dupont.assetTurnover.toFixed(2)}×</div>
            </div>
            <span className="text-muted-foreground text-lg">×</span>
            <div className="rounded-lg border border-amber-500/30 px-3 py-2 text-center bg-amber-500/5">
              <div className="text-xs text-muted-foreground">Equity Multiplier</div>
              <div className="text-lg font-bold text-amber-400">{dupont.equityMultiplier.toFixed(2)}×</div>
            </div>
          </div>

          {/* Breakdown table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Factor</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formula</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                {
                  factor: "Net Profit Margin",
                  formula: "Net Income / Revenue",
                  value: pct(dupont.netMargin),
                  insight: dupont.netMargin > 0.2 ? "Premium profitability" : dupont.netMargin > 0.1 ? "Solid margins" : dupont.netMargin > 0 ? "Thin margins — cost pressure" : "Loss-making",
                  color: "text-blue-400",
                },
                {
                  factor: "Asset Turnover",
                  formula: "Revenue / Total Assets",
                  value: `${dupont.assetTurnover.toFixed(2)}×`,
                  insight: dupont.assetTurnover > 1.0 ? "Asset-light / high efficiency" : dupont.assetTurnover > 0.5 ? "Moderate asset utilization" : "Capital-intensive business",
                  color: "text-purple-400",
                },
                {
                  factor: "Equity Multiplier",
                  formula: "Total Assets / Total Equity",
                  value: `${dupont.equityMultiplier.toFixed(2)}×`,
                  insight: dupont.equityMultiplier < 2 ? "Low leverage — conservative" : dupont.equityMultiplier < 4 ? "Moderate leverage" : "High leverage — amplifies returns and risks",
                  color: "text-amber-400",
                },
                {
                  factor: "Return on Assets (ROA)",
                  formula: "Net Income / Total Assets",
                  value: pct(dupont.roa),
                  insight: dupont.roa > 0.10 ? "Highly efficient use of assets" : dupont.roa > 0.05 ? "Adequate returns on assets" : dupont.roa > 0 ? "Low ROA" : "Negative ROA",
                  color: "text-foreground",
                },
                {
                  factor: "Return on Equity (ROE)",
                  formula: "Net Income / Total Equity",
                  value: pct(dupont.roe),
                  insight: dupont.roe > 0.20 ? "Exceptional shareholder returns" : dupont.roe > 0.12 ? "Above-average ROE" : dupont.roe > 0 ? "Below-average ROE" : "Destroying equity value",
                  color: dupont.roe > 0.15 ? "text-green-400" : dupont.roe > 0 ? "text-amber-400" : "text-red-400",
                },
              ].map(({ factor, formula, value, insight, color }) => (
                <tr key={factor} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-foreground">{factor}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{formula}</td>
                  <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", color)}>{value}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{insight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Earnings Quality Flags ───────────────────────────────────────────── */}
      <SectionCard
        title="Earnings Quality Flags"
        subtitle="Common red flags used by forensic analysts. Green = no concern, Amber = monitor, Red = investigate further."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flag</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {flags.map(({ label, status, finding }) => {
                const color = status === "clear" ? "text-green-400" : status === "watch" ? "text-amber-400" : "text-red-400"
                const badge = status === "clear" ? "CLEAR" : status === "watch" ? "WATCH" : "FLAG"
                const bgColor = status === "clear" ? "bg-green-500/15 text-green-400" : status === "watch" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
                return (
                  <tr key={label} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-foreground">{label}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", bgColor)}>
                        {badge}
                      </span>
                    </td>
                    <td className={cn("px-3 py-2 text-xs", color)}>{finding}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border bg-muted/10">
          These flags are quantitative screens, not accounting opinions. Always read the full 10-K notes for context.
        </p>
      </SectionCard>
    </div>
  )
}

// ── Piotroski F-Score calculation ─────────────────────────────────────────────

interface FSignal { pass: boolean | null; label: string; description: string; na?: boolean }

function computePiotroski(
  B: { net_income: number; ocf: number; total_assets: number; ebitda: number; ebitda_margin: number; gross_margin: number; revenue: number; eps: number; shares_diluted: number; bvps: number; total_debt: number },
  H: { revenue: number[]; net_income: number[]; eps: number[]; ocf: number[]; ebitda: number[]; bvps: number[] },
  n: number,
): { fScore: number; fSignals: FSignal[]; fAvailable: number } {
  const cur_ni    = B.net_income
  const cur_ocf   = B.ocf
  const cur_assets = B.total_assets
  const cur_roa   = cur_assets > 0 ? cur_ni / cur_assets : 0
  const cur_cfoRoa = cur_assets > 0 ? cur_ocf / cur_assets : 0
  const prv_ni    = n >= 2 ? H.net_income[n - 2] : null
  const prv_rev   = n >= 2 ? H.revenue[n - 2] : null
  const cur_rev   = n >= 1 ? H.revenue[n - 1] : B.revenue
  const cur_ebitdaM = cur_rev > 0 ? (n >= 1 ? H.ebitda[n - 1] / H.revenue[n - 1] : 0) : 0
  const prv_ebitdaM = n >= 2 && H.revenue[n - 2] > 0 ? H.ebitda[n - 2] / H.revenue[n - 2] : null
  const cur_bvps  = B.bvps
  const prv_bvps  = n >= 2 ? H.bvps[n - 2] : null
  // Approximate prior shares from NI/EPS
  const cur_shares = B.shares_diluted
  const prv_eps   = n >= 2 ? H.eps[n - 2] : null
  const prv_ni_v  = n >= 2 ? H.net_income[n - 2] : null
  const prv_shares = prv_eps && prv_ni_v && prv_eps !== 0 ? Math.abs(prv_ni_v / prv_eps) : null

  const signals: FSignal[] = [
    // Profitability
    {
      label: "F1: ROA Positive",
      pass: cur_roa > 0,
      description: `ROA = ${(cur_roa * 100).toFixed(2)}% (Net Income ÷ Total Assets = ${n0(cur_ni)} ÷ ${n0(cur_assets)})`,
    },
    {
      label: "F2: OCF Positive",
      pass: cur_ocf > 0,
      description: `Operating Cash Flow = $${cur_ocf.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`,
    },
    {
      label: "F3: ROA Improving",
      pass: prv_ni !== null ? cur_ni > prv_ni : null,
      na: prv_ni === null,
      description: prv_ni !== null
        ? `Net Income: ${n0(cur_ni)} vs prior ${n0(prv_ni)} (proxy: NI growth)`
        : "Prior year NI unavailable",
    },
    {
      label: "F4: Accrual Quality (OCF > NI)",
      pass: cur_ocf > cur_ni,
      description: `OCF ${n0(cur_ocf)} ${cur_ocf > cur_ni ? ">" : "<"} Net Income ${n0(cur_ni)} — cash earnings ${cur_ocf > cur_ni ? "exceed" : "lag"} accounting earnings`,
    },
    // Leverage & Liquidity
    {
      label: "F5: Leverage Decreasing",
      pass: prv_bvps !== null
        ? (B.total_debt / Math.max(cur_assets, 1)) < (B.total_debt / Math.max(cur_assets, 1))  // same period — N/A without hist debt
            ? true : false
        : null,
      na: true,
      description: "Prior-year total debt/assets not available in XBRL summary (requires historical balance sheet)",
    },
    {
      label: "F6: Liquidity (Current Ratio) Improving",
      pass: null,
      na: true,
      description: "Current assets and current liabilities not reported in XBRL companyfacts — requires detailed balance sheet",
    },
    {
      label: "F7: No Share Dilution",
      pass: prv_shares !== null ? cur_shares <= prv_shares * 1.005 : null,
      na: prv_shares === null,
      description: prv_shares !== null
        ? `Shares: ${cur_shares.toFixed(1)}M vs prior ${prv_shares.toFixed(1)}M (estimated from NI÷EPS)`
        : "Prior year shares not directly available",
    },
    // Operating Efficiency
    {
      label: "F8: Gross Margin Improving",
      pass: prv_ebitdaM !== null ? cur_ebitdaM > prv_ebitdaM : null,
      na: prv_ebitdaM === null,
      description: prv_ebitdaM !== null
        ? `EBITDA margin: ${(cur_ebitdaM * 100).toFixed(1)}% vs prior ${(prv_ebitdaM * 100).toFixed(1)}% (proxy — exact gross margin not in hist)`
        : "Prior year margin unavailable",
    },
    {
      label: "F9: Asset Turnover Improving",
      pass: prv_rev !== null ? cur_rev > prv_rev : null,
      na: prv_rev === null,
      description: prv_rev !== null
        ? `Revenue: ${n0(cur_rev)} vs prior ${n0(prv_rev)} (proxy — prior year assets not available)`
        : "Prior year assets unavailable for turnover computation",
    },
  ]

  const available = signals.filter((s) => !s.na && s.pass !== null)
  const passed    = available.filter((s) => s.pass === true)

  return {
    fScore:     passed.length,
    fSignals:   signals,
    fAvailable: available.length,
  }
}

function n0(v: number) {
  return `$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`
}

// ── Altman Z-Score calculation ─────────────────────────────────────────────────

interface ZComponent { label: string; value: string; weight: string; contribution: string }

function computeAltman(B: {
  net_income: number; total_assets: number; total_equity: number; total_debt: number;
  ebit: number; revenue: number; current_price: number; shares_diluted: number;
}): { zScore: number; zComponents: ZComponent[]; zZone: "Safe" | "Grey" | "Distress" } {
  const A = B.total_assets || 1
  const E = B.total_equity
  const D = B.total_debt || 0
  const totalLiab = Math.max(A - E, 0) || 1
  const marketCap = B.current_price * B.shares_diluted

  // X1: Working Capital / Assets — estimated at conservative 0.10 (no current assets in XBRL)
  const X1 = 0.10
  // X2: Retained Earnings / Assets — approximate using equity / assets
  const X2 = clamp(E / A, -1, 1)
  // X3: EBIT / Assets
  const X3 = B.ebit / A
  // X4: Market Cap / Total Liabilities
  const X4 = marketCap / totalLiab
  // X5: Revenue / Assets
  const X5 = B.revenue / A

  const W1 = 1.2, W2 = 1.4, W3 = 3.3, W4 = 0.6, W5 = 1.0
  const zScore = W1 * X1 + W2 * X2 + W3 * X3 + W4 * X4 + W5 * X5

  const zZone: "Safe" | "Grey" | "Distress" =
    zScore > 2.99 ? "Safe" : zScore > 1.81 ? "Grey" : "Distress"

  const zComponents: ZComponent[] = [
    { label: "X1 — Working Capital / Assets (est. 0.10)", value: X1.toFixed(2), weight: "1.2×", contribution: (W1 * X1).toFixed(3) },
    { label: "X2 — Equity / Assets (proxy for Retained Earnings)", value: X2.toFixed(3), weight: "1.4×", contribution: (W2 * X2).toFixed(3) },
    { label: "X3 — EBIT / Total Assets", value: X3.toFixed(3), weight: "3.3×", contribution: (W3 * X3).toFixed(3) },
    { label: "X4 — Market Cap / Total Liabilities", value: X4.toFixed(3), weight: "0.6×", contribution: (W4 * X4).toFixed(3) },
    { label: "X5 — Revenue / Total Assets", value: X5.toFixed(3), weight: "1.0×", contribution: (W5 * X5).toFixed(3) },
  ]

  return { zScore, zComponents, zZone }
}

// ── Cash Flow Quality ──────────────────────────────────────────────────────────

interface CFMetric { label: string; value: string; rating: string; interp: string; positive: boolean }

function computeCashFlowQuality(B: {
  net_income: number; ocf: number; total_assets: number; capex: number; revenue: number; current_price: number; shares_diluted: number;
}): { metrics: CFMetric[]; sloanRatio: number; ocfNiRatio: number } {
  const fcf = B.ocf - B.capex
  const marketCap = B.current_price * B.shares_diluted
  const sloanRatio = B.total_assets > 0 ? (B.net_income - B.ocf) / B.total_assets : 0
  const ocfNiRatio = B.net_income !== 0 ? B.ocf / B.net_income : 0
  const fcfConversion = B.net_income !== 0 ? fcf / B.net_income : 0
  const fcfYield = marketCap > 0 ? fcf / marketCap : 0
  const fcfMargin = B.revenue > 0 ? fcf / B.revenue : 0

  const metrics: CFMetric[] = [
    {
      label: "Sloan Accrual Ratio (NI − OCF) / Assets",
      value: `${sloanRatio >= 0 ? "+" : ""}${(sloanRatio * 100).toFixed(2)}%`,
      rating: sloanRatio < -0.05 ? "Excellent" : sloanRatio < 0.05 ? "Good" : "Caution",
      interp: sloanRatio < -0.10 ? "Cash far exceeds accounting income — very high quality"
        : sloanRatio < 0 ? "Cash slightly exceeds reported earnings — high quality"
        : sloanRatio < 0.10 ? "Minor accrual build-up — within normal range"
        : "Significant accrual build-up — earnings may be inflated",
      positive: sloanRatio < 0.05,
    },
    {
      label: "Cash Conversion Ratio (OCF / Net Income)",
      value: `${ocfNiRatio.toFixed(2)}×`,
      rating: ocfNiRatio > 1.2 ? "Excellent" : ocfNiRatio > 0.8 ? "Good" : ocfNiRatio > 0.5 ? "Below Avg" : "Poor",
      interp: ocfNiRatio > 1.2 ? "Cash generation significantly exceeds accounting profits"
        : ocfNiRatio > 0.8 ? "Earnings well-backed by operating cash flows"
        : "Accruals exceeding cash — review working capital trends",
      positive: ocfNiRatio > 0.8,
    },
    {
      label: "FCF Conversion (FCF / Net Income)",
      value: `${fcfConversion.toFixed(2)}×`,
      rating: fcfConversion > 0.9 ? "Strong" : fcfConversion > 0.6 ? "Adequate" : "Weak",
      interp: fcfConversion > 0.9 ? "Most earnings convert to distributable free cash"
        : fcfConversion > 0.6 ? "Solid conversion after maintenance CapEx"
        : fcfConversion > 0 ? "High reinvestment needs reducing free cash"
        : "Negative FCF — growth-stage or restructuring company",
      positive: fcfConversion > 0.6,
    },
    {
      label: "FCF Margin (FCF / Revenue)",
      value: pct(fcfMargin),
      rating: fcfMargin > 0.15 ? "Strong" : fcfMargin > 0.08 ? "Good" : fcfMargin > 0 ? "Thin" : "Negative",
      interp: fcfMargin > 0.15 ? "Highly capital-efficient business model"
        : fcfMargin > 0.08 ? "Healthy cash generation relative to sales"
        : fcfMargin > 0 ? "Positive but modest cash margins"
        : "Burning cash — monitor liquidity",
      positive: fcfMargin > 0.08,
    },
    {
      label: "FCF Yield (FCF / Market Cap)",
      value: pct(fcfYield, 2),
      rating: fcfYield > 0.05 ? "Attractive" : fcfYield > 0.02 ? "Fair" : fcfYield > 0 ? "Low" : "Negative",
      interp: fcfYield > 0.05 ? "High cash return — potentially undervalued"
        : fcfYield > 0.02 ? "Moderate yield — fairly valued by cash flow"
        : fcfYield > 0 ? "Low yield — premium multiple priced in"
        : "Negative FCF yield",
      positive: fcfYield > 0.03,
    },
  ]

  return { metrics, sloanRatio, ocfNiRatio }
}

// ── DuPont Analysis ────────────────────────────────────────────────────────────

function computeDuPont(B: { net_income: number; revenue: number; total_assets: number; total_equity: number }) {
  const netMargin      = B.revenue > 0 ? B.net_income / B.revenue : 0
  const assetTurnover  = B.total_assets > 0 ? B.revenue / B.total_assets : 0
  const equityMultiplier = B.total_equity !== 0 ? B.total_assets / B.total_equity : 1
  const roa = B.total_assets > 0 ? B.net_income / B.total_assets : 0
  const roe = B.total_equity !== 0 ? B.net_income / B.total_equity : 0
  return { netMargin, assetTurnover, equityMultiplier, roa, roe }
}

// ── Earnings Quality Flags ─────────────────────────────────────────────────────

interface EarningsFlag { label: string; status: "clear" | "watch" | "flag"; finding: string }

function computeEarningsFlags(
  B: { net_income: number; ocf: number; capex: number; revenue: number; total_assets: number; ebitda: number; total_debt: number; net_debt: number },
  H: { revenue: number[]; net_income: number[]; ocf: number[]; ebitda: number[] },
  n: number,
): EarningsFlag[] {
  const sloan = B.total_assets > 0 ? (B.net_income - B.ocf) / B.total_assets : 0
  const revGrowth = n >= 2 && H.revenue[n - 2] > 0 ? (H.revenue[n - 1] / H.revenue[n - 2] - 1) : 0
  const niGrowth  = n >= 2 && H.net_income[n - 2] > 0 ? (H.net_income[n - 1] / H.net_income[n - 2] - 1) : 0
  const ocfGrowth = n >= 2 && H.ocf[n - 2] > 0 ? (H.ocf[n - 1] / H.ocf[n - 2] - 1) : 0
  const ebitdaM   = B.revenue > 0 ? B.ebitda / B.revenue : 0
  const prv_ebitdaM = n >= 2 && H.revenue[n - 2] > 0 ? H.ebitda[n - 2] / H.revenue[n - 2] : null

  return [
    {
      label: "Earnings Backed by Cash (OCF ≥ NI)",
      status: B.ocf >= B.net_income ? "clear" : B.ocf >= B.net_income * 0.7 ? "watch" : "flag",
      finding: B.ocf >= B.net_income
        ? `OCF ($${(B.ocf).toFixed(0)}M) ≥ Net Income ($${(B.net_income).toFixed(0)}M) — solid cash backing`
        : `OCF ($${(B.ocf).toFixed(0)}M) lags Net Income ($${(B.net_income).toFixed(0)}M) — accruals building`,
    },
    {
      label: "Revenue and Earnings Growing Together",
      status: n < 2 ? "watch"
        : revGrowth > 0 && niGrowth > 0 ? "clear"
        : revGrowth > 0 && niGrowth < -0.15 ? "flag"
        : "watch",
      finding: n < 2 ? "Insufficient history"
        : revGrowth > 0 && niGrowth > 0 ? `Both revenue (+${(revGrowth * 100).toFixed(1)}%) and NI (+${(niGrowth * 100).toFixed(1)}%) growing`
        : revGrowth > 0 && niGrowth < 0 ? `Revenue growing but NI declining — margin compression or one-time charges`
        : `Revenue and NI trends diverging — investigate`,
    },
    {
      label: "OCF Growing in Line with Revenue",
      status: n < 2 ? "watch"
        : Math.abs(ocfGrowth - revGrowth) < 0.10 ? "clear"
        : revGrowth > ocfGrowth + 0.15 ? "flag"
        : "watch",
      finding: n < 2 ? "Insufficient history"
        : `Revenue growth ${(revGrowth * 100).toFixed(1)}% vs OCF growth ${(ocfGrowth * 100).toFixed(1)}%`
        + (Math.abs(ocfGrowth - revGrowth) < 0.10 ? " — aligned" : " — divergence noted"),
    },
    {
      label: "EBITDA Margin Stable or Expanding",
      status: prv_ebitdaM === null ? "watch"
        : ebitdaM >= prv_ebitdaM - 0.01 ? "clear"
        : ebitdaM >= prv_ebitdaM - 0.03 ? "watch"
        : "flag",
      finding: prv_ebitdaM !== null
        ? `EBITDA margin ${(ebitdaM * 100).toFixed(1)}% vs prior ${(prv_ebitdaM * 100).toFixed(1)}% — ${ebitdaM >= prv_ebitdaM ? "expanding" : "contracting"}`
        : "Prior year margin unavailable",
    },
    {
      label: "Accrual Ratio Within Normal Bounds",
      status: sloan < 0.05 ? "clear" : sloan < 0.10 ? "watch" : "flag",
      finding: `Sloan accrual ratio = ${(sloan * 100).toFixed(2)}% ${sloan < 0 ? "(negative = high quality)" : sloan < 0.05 ? "(normal range)" : "(elevated — review receivables and working capital)"}`,
    },
    {
      label: "Positive Net Income",
      status: B.net_income > 0 ? "clear" : "flag",
      finding: B.net_income > 0
        ? `Net income positive at $${B.net_income.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`
        : `Net loss of ($${Math.abs(B.net_income).toLocaleString("en-US", { maximumFractionDigits: 0 })})M`,
    },
    {
      label: "Positive Free Cash Flow",
      status: B.ocf - B.capex > 0 ? "clear" : B.ocf - B.capex > -B.revenue * 0.05 ? "watch" : "flag",
      finding: B.ocf - B.capex > 0
        ? `FCF of $${(B.ocf - B.capex).toLocaleString("en-US", { maximumFractionDigits: 0 })}M — self-funding operations`
        : `Negative FCF of ($${Math.abs(B.ocf - B.capex).toLocaleString("en-US", { maximumFractionDigits: 0 })})M`,
    },
    {
      label: "Debt Load Manageable (Net Debt/EBITDA)",
      status: B.net_debt < 0 ? "clear"
        : B.ebitda > 0 && B.net_debt / B.ebitda < 3 ? "clear"
        : B.ebitda > 0 && B.net_debt / B.ebitda < 5 ? "watch"
        : "flag",
      finding: B.net_debt < 0
        ? "Net cash position — no debt concern"
        : B.ebitda > 0
          ? `Net Debt/EBITDA = ${(B.net_debt / B.ebitda).toFixed(1)}×`
          : "Cannot compute — EBITDA not positive",
    },
  ]
}
