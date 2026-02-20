"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHART_COLORS } from "@/lib/valuation/presets"
import type { ComputedValuations } from "@/lib/valuation/calculations"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Row {
  model: string
  value: number
  premiumPct: number   // (value / market - 1) * 100
  weight: number       // 0–1
  color: string
}

type SortKey = "model" | "value" | "premiumPct" | "weight"
type SortDir = "asc" | "desc"

// ── Weights (same as Football Field) ─────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  "FCFF (DCF)":       0.30,
  "DDM (2-Stage)":    0.05,
  "EBITDA Multiple":  0.15,
  "Revenue Multiple": 0.05,
  "P/E Multiple":     0.10,
  PEG:                0.05,
  "P/B":              0.05,
  SOTP:               0.25,
}

// ── Gradient for premium/discount ────────────────────────────────────────────
// Maps a percentage in [-40, +40] to a CSS rgba color.
// Positive  → green family   |   Negative → red family

function premiumColor(pct: number): { bg: string; text: string } {
  const clamped = Math.max(-40, Math.min(40, pct))
  const intensity = Math.abs(clamped) / 40          // 0 → 1

  if (clamped > 0) {
    // green: from neutral → #16a34a
    const g = Math.round(163 * intensity)
    const r = Math.round(22  * intensity)
    const b = Math.round(74  * intensity)
    return {
      bg:   `rgba(${r}, ${g}, ${b}, ${0.12 + intensity * 0.18})`,
      text: intensity > 0.35 ? `rgb(${r}, ${g}, ${b})` : "hsl(var(--foreground))",
    }
  } else if (clamped < 0) {
    // red: from neutral → #dc2626
    const r = Math.round(220 * intensity)
    const g = Math.round(38  * intensity)
    const b = Math.round(38  * intensity)
    return {
      bg:   `rgba(${r}, ${g}, ${b}, ${0.12 + intensity * 0.18})`,
      text: intensity > 0.35 ? `rgb(${r}, ${g}, ${b})` : "hsl(var(--foreground))",
    }
  }
  return { bg: "transparent", text: "hsl(var(--muted-foreground))" }
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30" />
  return dir === "asc"
    ? <ArrowUp   className="w-3 h-3 text-blue-400" />
    : <ArrowDown className="w-3 h-3 text-blue-400" />
}

// ── Header cell ───────────────────────────────────────────────────────────────

function Th({
  label, col, sortKey, sortDir, onSort, align = "right",
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (col: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none",
        "text-muted-foreground hover:text-foreground transition-colors",
        align === "left" ? "text-left" : "text-right",
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
        {label}
        <SortIcon col={col} active={active} dir={sortDir} />
      </span>
    </th>
  )
}

// ── Weight bar ────────────────────────────────────────────────────────────────

function WeightBar({ weight, color }: { weight: number; color: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${weight * 100}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground w-7 text-right tabular-nums">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  computed: ComputedValuations
  marketPrice: number
  /** Optional weight overrides */
  weights?: Partial<Record<string, number>>
  className?: string
}

export function ModelComparisonTable({ computed, marketPrice, weights, className }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("weight")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const effectiveWeights = { ...WEIGHTS, ...weights }

  const rows = useMemo<Row[]>(() => {
    const raw: [string, number][] = [
      ["FCFF (DCF)",       computed.pps_fcff],
      ["DDM (2-Stage)",    computed.pps_ddm],
      ["EBITDA Multiple",  computed.pps_ebitda],
      ["Revenue Multiple", computed.pps_rev],
      ["P/E Multiple",     computed.pps_pe],
      ["PEG",              computed.pps_peg],
      ["P/B",              computed.pps_pb],
      ["SOTP",             computed.pps_sotp],
    ]

    return raw.map(([model, value]) => ({
      model,
      value,
      premiumPct: marketPrice > 0 ? ((value / marketPrice) - 1) * 100 : 0,
      weight: effectiveWeights[model] ?? 0,
      color: CHART_COLORS[model] ?? "#64748b",
    }))
  }, [computed, marketPrice, effectiveWeights])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let diff: number
      if (sortKey === "model") {
        diff = a.model.localeCompare(b.model)
      } else {
        diff = a[sortKey] - b[sortKey]
      }
      return sortDir === "asc" ? diff : -diff
    })
  }, [rows, sortKey, sortDir])

  const handleSort = (col: SortKey) => {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(col)
      setSortDir("desc")
    }
  }

  // Blended value
  const blended = rows.reduce((acc, r) => acc + r.value * r.weight, 0)
  const blendedPct = marketPrice > 0 ? ((blended / marketPrice) - 1) * 100 : 0
  const blendedColors = premiumColor(blendedPct)

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <Th label="Model"            col="model"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left" />
            <Th label="Value"            col="value"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <Th label="Premium / Disc."  col="premiumPct" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <Th label="Weight"           col="weight"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>

        <tbody className="divide-y divide-border/60">
          {sorted.map((row) => {
            const { bg, text } = premiumColor(row.premiumPct)
            return (
              <tr
                key={row.model}
                className="hover:bg-muted/20 transition-colors"
              >
                {/* Model */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: row.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{row.model}</span>
                  </span>
                </td>

                {/* Value */}
                <td className="px-4 py-3 text-right font-mono text-sm text-foreground tabular-nums">
                  ${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>

                {/* Premium / Discount */}
                <td className="px-4 py-3 text-right">
                  <span
                    className="inline-block rounded-md px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition-colors"
                    style={{ background: bg, color: text }}
                  >
                    {row.premiumPct >= 0 ? "+" : ""}
                    {row.premiumPct.toFixed(1)}%
                  </span>
                </td>

                {/* Weight */}
                <td className="px-4 py-3">
                  <WeightBar weight={row.weight} color={row.color} />
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Blended footer row */}
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/30">
            <td className="px-4 py-3 text-sm font-bold text-foreground">Blended</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground tabular-nums">
              ${blended.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className="inline-block rounded-md px-2.5 py-1 font-mono text-xs font-bold tabular-nums"
                style={{ background: blendedColors.bg, color: blendedColors.text }}
              >
                {blendedPct >= 0 ? "+" : ""}
                {blendedPct.toFixed(1)}%
              </span>
            </td>
            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
