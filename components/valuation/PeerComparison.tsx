"use client"

import { useState, useMemo } from "react"
import { BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeerData {
  ticker: string
  name?: string
  pe: number         // trailing P/E  (NaN = N/A)
  ev_ebitda: number  // EV/EBITDA multiple
  rev_growth: number // YoY revenue growth %
  market_cap: number // USD billions
}

type AggMode = "mean" | "median"

// ── Stat helpers ──────────────────────────────────────────────────────────────

const finite  = (arr: number[]) => arr.filter((v) => isFinite(v))
const positive = (arr: number[]) => arr.filter((v) => isFinite(v) && v > 0)

function _mean(arr: number[], positiveOnly: boolean) {
  const v = positiveOnly ? positive(arr) : finite(arr)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

function _median(arr: number[], positiveOnly: boolean) {
  const v = [...(positiveOnly ? positive(arr) : finite(arr))].sort((a, b) => a - b)
  if (!v.length) return NaN
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

function agg(arr: number[], mode: AggMode, positiveOnly = true) {
  return mode === "mean" ? _mean(arr, positiveOnly) : _median(arr, positiveOnly)
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtMult   = (v: number) => isFinite(v) && v > 0 ? `${v.toFixed(1)}×` : "—"
const fmtGrowth = (v: number) => isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"
const fmtMcap   = (v: number) => {
  if (!isFinite(v) || v <= 0) return "—"
  return v >= 1_000 ? `$${(v / 1_000).toFixed(2)}T` : `$${v.toFixed(0)}B`
}

// ── Column config ─────────────────────────────────────────────────────────────

interface ColDef {
  key: keyof Pick<PeerData, "pe" | "ev_ebitda" | "rev_growth" | "market_cap">
  label: string
  fmt: (v: number) => string
  color: string
  positiveOnly: boolean
}

const COLS: ColDef[] = [
  { key: "pe",         label: "P/E",        fmt: fmtMult,   color: "#60a5fa", positiveOnly: true  },
  { key: "ev_ebitda",  label: "EV/EBITDA",  fmt: fmtMult,   color: "#a78bfa", positiveOnly: true  },
  { key: "rev_growth", label: "Rev Growth", fmt: fmtGrowth, color: "#34d399", positiveOnly: false },
  { key: "market_cap", label: "Mkt Cap",    fmt: fmtMcap,   color: "#fb923c", positiveOnly: true  },
]

// ── Mini spark bar ────────────────────────────────────────────────────────────

function SparkBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 && isFinite(value) ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-12 h-1 rounded-full bg-muted overflow-hidden shrink-0">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function MetricCell({
  value, col, max, isSubject,
}: {
  value: number; col: ColDef; max: number; isSubject?: boolean
}) {
  const growthColor =
    col.key === "rev_growth"
      ? value >= 0 ? "text-emerald-400" : "text-red-400"
      : undefined

  return (
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-2.5">
        <SparkBar value={value} max={max} color={col.color} />
        <span
          className={cn(
            "font-mono text-xs tabular-nums w-14 text-right",
            growthColor ?? (isSubject ? "text-foreground font-semibold" : "text-muted-foreground"),
          )}
        >
          {col.fmt(value)}
        </span>
      </div>
    </td>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PeerRow({ row, maxes, isSubject }: {
  row: PeerData
  maxes: Record<string, number>
  isSubject?: boolean
}) {
  return (
    <tr
      className={cn(
        "transition-colors",
        isSubject
          ? "bg-blue-500/10 border-l-[3px] border-l-blue-500 hover:bg-blue-500/15"
          : "hover:bg-muted/20",
      )}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={cn("text-sm font-semibold", isSubject ? "text-blue-400" : "text-foreground")}>
            {row.ticker}
          </span>
          {row.name && (
            <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">{row.name}</span>
          )}
        </div>
      </td>
      {COLS.map((col) => (
        <MetricCell
          key={col.key}
          value={row[col.key] as number}
          col={col}
          max={maxes[col.key]}
          isSubject={isSubject}
        />
      ))}
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  peers: PeerData[]
  subject: PeerData
  className?: string
}

export function PeerComparison({ peers, subject, className }: Props) {
  const [mode, setMode] = useState<AggMode>("median")

  const maxes = useMemo(() => {
    const all = [...peers, subject]
    return Object.fromEntries(
      COLS.map((col) => [
        col.key,
        Math.max(0, ...all.map((r) => r[col.key] as number).filter(isFinite)),
      ])
    ) as Record<string, number>
  }, [peers, subject])

  const aggRow = useMemo(
    () =>
      Object.fromEntries(
        COLS.map((col) => [
          col.key,
          agg(peers.map((p) => p[col.key] as number), mode, col.positiveOnly),
        ])
      ) as Record<string, number>,
    [peers, mode],
  )

  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Peer Comparison</span>
          <span className="text-xs text-muted-foreground/60">{peers.length} peers</span>
        </div>

        {/* Mean / Median toggle */}
        <div className="flex rounded-md overflow-hidden border border-border text-xs font-medium">
          {(["median", "mean"] as AggMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 capitalize transition-colors",
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border/60">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">
              Company
            </th>
            {COLS.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border/50">
          {/* Subject (highlighted) */}
          <PeerRow row={subject} maxes={maxes} isSubject />
          {/* Peers */}
          {peers.map((peer) => (
            <PeerRow key={peer.ticker} row={peer} maxes={maxes} />
          ))}
        </tbody>

        {/* Aggregate footer */}
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/30">
            <td className="px-4 py-2.5">
              <span className="text-xs font-bold text-foreground capitalize">
                Peer {mode}
              </span>
            </td>
            {COLS.map((col) => (
              <td key={col.key} className="px-4 py-2.5 text-right">
                <span className="font-mono text-xs font-bold text-foreground">
                  {col.fmt(aggRow[col.key])}
                </span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
