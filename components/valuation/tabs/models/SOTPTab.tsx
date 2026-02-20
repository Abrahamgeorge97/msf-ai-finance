"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Plus, Trash2 } from "lucide-react"
import { MetricCard } from "../../shared/MetricCard"
import { fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { useScenario } from "@/context/ScenarioContext"
import type { ValuationConfig } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

interface SegmentRow {
  id: number
  name: string
  revenue: number      // $M
  margin: number       // as decimal e.g. 0.27
  multiple: number     // EV/EBITDA
}

const SEG_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#9333EA", "#EA580C", "#0891B2", "#CA8A04", "#BE185D"]

let _segId = 0

export function SOTPTab({ config, computed }: Props) {
  const { assumptions: a } = useScenario()
  const B = config.baseline
  const defaultMult = computed.medianEvm > 0 ? computed.medianEvm : 14.0

  // ── Initialise from config.segments ───────────────────────────────────────
  const [segments, setSegments] = useState<SegmentRow[]>(() => {
    const entries = Object.entries(config.segments)
    if (entries.length === 0) {
      // Fallback: single "Core Business" segment using baseline data
      return [{
        id: ++_segId,
        name: "Core Business",
        revenue: B.adj_ebitda > 0 && B.ebitda_margin > 0 ? B.revenue : B.revenue,
        margin:  B.ebitda_margin > 0 ? B.ebitda_margin : 0.25,
        multiple: defaultMult,
      }]
    }
    return entries.map(([name, seg]) => ({
      id: ++_segId,
      name,
      revenue:  seg.revenue,
      margin:   seg.adj_op_margin > 0 ? seg.adj_op_margin : B.ebitda_margin,
      multiple: defaultMult,
    }))
  })

  const [newSegName, setNewSegName] = useState("")

  // ── Derived calculations ──────────────────────────────────────────────────
  const rows = useMemo(() =>
    segments.map((s) => ({
      ...s,
      ebitda: s.revenue * s.margin,
      ev:     s.revenue * s.margin * s.multiple,
    })),
    [segments],
  )

  const totalEV      = rows.reduce((sum, r) => sum + r.ev, 0)
  const equityValue  = totalEV - B.net_debt
  const pps          = B.shares_diluted > 0 ? equityValue / B.shares_diluted : 0
  const vsMarket     = B.current_price > 0 ? ((pps / B.current_price) - 1) * 100 : 0

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateSeg = (id: number, field: keyof SegmentRow, raw: string) => {
    const numVal = parseFloat(raw)
    setSegments((prev) =>
      prev.map((s) => s.id === id ? { ...s, [field]: isNaN(numVal) ? s[field] : numVal } : s),
    )
  }

  const addSegment = () => {
    const name = newSegName.trim() || `Segment ${segments.length + 1}`
    setSegments((prev) => [
      ...prev,
      { id: ++_segId, name, revenue: 500, margin: 0.25, multiple: defaultMult },
    ])
    setNewSegName("")
  }

  const removeSegment = (id: number) => {
    if (segments.length <= 1) return
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }

  // ── Sensitivity: vary multiple ±3x around medianEvm ───────────────────────
  const multRange = Array.from({ length: 7 }, (_, i) => defaultMult - 3 + i)
  const sensData = multRange.map((m) =>
    multRange.map((m2) => {
      if (m2 !== m) return ""   // only diagonal — easier: single-axis
      return ""
    }),
  )

  // Single-axis sensitivity: global multiple delta
  const sensRows = multRange.map((m) => {
    const ev = rows.reduce((sum, r) => sum + r.ebitda * m, 0)
    const eq  = ev - B.net_debt
    const p   = B.shares_diluted > 0 ? eq / B.shares_diluted : 0
    return { mult: m, ev, eq, pps: p }
  })

  // ── Pie chart data ─────────────────────────────────────────────────────────
  const pieData = rows
    .filter((r) => r.ev > 0)
    .map((r) => ({ name: r.name, value: r.ev }))

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        SOTP — Segment EV = Segment Revenue × EBITDA Margin × EV/EBITDA Multiple. Sum → less net debt → equity value → price per share.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total EV"     value={fmtUsd(totalEV, 0) + "M"} />
        <MetricCard label="Less Net Debt" value={`(${fmtUsd(B.net_debt, 0)}M)`} />
        <MetricCard label="Equity Value" value={fmtUsd(equityValue, 0) + "M"} />
        <MetricCard
          label="Price / Share"
          value={fmtUsd(pps, 2)}
          delta={`${vsMarket >= 0 ? "+" : ""}${vsMarket.toFixed(1)}% vs market`}
          deltaPositive={vsMarket >= 0}
        />
      </div>

      {/* Segment table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold text-foreground">Segment Breakdown</p>
          <span className="text-xs text-muted-foreground">Edit margin % and EV/EBITDA multiple per segment</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Segment", "Revenue ($M)", "EBITDA Margin", "EBITDA ($M)", "EV/EBITDA", "Segment EV ($M)", "% of Total", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right first:text-left last:text-center">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <input
                      value={r.name}
                      onChange={(e) =>
                        setSegments((prev) =>
                          prev.map((s) => s.id === r.id ? { ...s, name: e.target.value } : s),
                        )
                      }
                      className="bg-transparent text-foreground text-xs font-semibold w-40 outline-none border-b border-border focus:border-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    <input
                      type="number"
                      value={r.revenue}
                      onChange={(e) => updateSeg(r.id, "revenue", e.target.value)}
                      className="bg-transparent text-right text-foreground font-mono text-xs w-20 outline-none border-b border-border focus:border-blue-500"
                      step={100}
                      min={0}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        value={(r.margin * 100).toFixed(1)}
                        onChange={(e) => updateSeg(r.id, "margin", String(parseFloat(e.target.value) / 100))}
                        className="bg-transparent text-right text-foreground font-mono text-xs w-14 outline-none border-b border-border focus:border-blue-500"
                        step={0.5}
                        min={0}
                        max={100}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {fmtUsd(r.ebitda, 0)}M
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        value={r.multiple.toFixed(1)}
                        onChange={(e) => updateSeg(r.id, "multiple", e.target.value)}
                        className="bg-transparent text-right text-foreground font-mono text-xs w-14 outline-none border-b border-border focus:border-blue-500"
                        step={0.5}
                        min={1}
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-foreground">
                    {fmtUsd(r.ev, 0)}M
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {totalEV > 0 ? ((r.ev / totalEV) * 100).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeSegment(r.id)}
                      disabled={segments.length <= 1}
                      className="text-muted-foreground hover:text-red-400 disabled:opacity-20 transition-colors"
                      aria-label="Remove segment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-muted/30 border-t-2 border-border font-semibold">
                <td className="px-3 py-2 text-xs text-foreground" colSpan={3}>Total</td>
                <td className="px-3 py-2 text-right text-xs font-mono text-foreground">
                  {fmtUsd(rows.reduce((s, r) => s + r.ebitda, 0), 0)}M
                </td>
                <td />
                <td className="px-3 py-2 text-right text-xs font-mono text-foreground">
                  {fmtUsd(totalEV, 0)}M
                </td>
                <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">100%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add segment row */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/10">
          <input
            value={newSegName}
            onChange={(e) => setNewSegName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSegment()}
            placeholder="New segment name…"
            className="flex-1 bg-transparent text-xs text-foreground border-b border-border outline-none placeholder:text-muted-foreground/50 py-1 focus:border-blue-500"
          />
          <button
            onClick={addSegment}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Segment
          </button>
        </div>
      </div>

      {/* Bridge + Pie chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* EV Bridge */}
        <div className="rounded-lg border border-border overflow-hidden">
          <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
            EV → Equity Bridge
          </p>
          <table className="w-full text-sm font-mono">
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 text-xs font-sans text-muted-foreground">{r.name}</td>
                  <td className="px-4 py-2 text-right text-foreground text-xs">{fmtUsd(r.ev, 0)}M</td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-2 text-xs font-sans text-foreground">Total Enterprise Value</td>
                <td className="px-4 py-2 text-right text-foreground text-xs">{fmtUsd(totalEV, 0)}M</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="px-4 py-2 text-xs font-sans text-muted-foreground">Less: Net Debt</td>
                <td className="px-4 py-2 text-right text-red-400 text-xs">({fmtUsd(B.net_debt, 0)}M)</td>
              </tr>
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2 text-xs font-sans text-foreground">Equity Value</td>
                <td className="px-4 py-2 text-right text-foreground text-xs">{fmtUsd(equityValue, 0)}M</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="px-4 py-2 text-xs font-sans text-muted-foreground">Shares Diluted</td>
                <td className="px-4 py-2 text-right text-muted-foreground text-xs">{B.shares_diluted.toFixed(1)}M</td>
              </tr>
              <tr className="bg-blue-500/10 border-t-2 border-blue-500/20 font-bold">
                <td className="px-4 py-2 text-xs font-sans text-blue-300">Price / Share</td>
                <td className="px-4 py-2 text-right text-blue-300 text-sm">{fmtUsd(pps, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pie chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Segment EV Contribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={SEG_COLORS[i % SEG_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                  formatter={(v: number) => [fmtUsd(v, 0) + "M", "Segment EV"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No positive EV segments to display
            </div>
          )}
        </div>
      </div>

      {/* Sensitivity: EV/EBITDA multiple vs Price */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Sensitivity — Global EV/EBITDA Multiple vs Price per Share
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground">EV/EBITDA</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Total EV ($M)</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Equity Value ($M)</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Price / Share</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">vs Market</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sensRows.map((row) => {
                const up = B.current_price > 0 && row.pps > 0
                  ? ((row.pps / B.current_price) - 1) * 100 : 0
                const isBase = Math.abs(row.mult - defaultMult) < 0.01
                return (
                  <tr key={row.mult} className={`hover:bg-muted/20 ${isBase ? "bg-blue-500/5" : ""}`}>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.mult.toFixed(1)}×{isBase && <span className="ml-1 text-[9px] text-blue-400 font-semibold">BASE</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-foreground">{fmtUsd(row.ev, 0)}M</td>
                    <td className="px-4 py-2 text-right text-xs text-foreground">{fmtUsd(row.eq, 0)}M</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-foreground">{fmtUsd(row.pps, 2)}</td>
                    <td className={`px-4 py-2 text-right text-xs font-semibold ${up >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {up >= 0 ? "+" : ""}{up.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Edit any segment&apos;s revenue, margin, or multiple inline. Click &quot;Add Segment&quot; to split the company into sub-divisions.
        Implied multiple for the whole company: <span className="font-semibold text-foreground">{fmtPct(a.target_ebitda_m, 1)} target margin × peer median {defaultMult.toFixed(1)}×</span>.
      </p>
    </div>
  )
}
