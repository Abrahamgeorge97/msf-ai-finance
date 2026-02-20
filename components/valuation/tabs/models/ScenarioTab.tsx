"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { MetricCard } from "../../shared/MetricCard"
import { computeAll, fmtUsd, fmtPct } from "@/lib/valuation/calculations"
import { SCENARIO_PRESETS, DEFAULT_ASSUMPTIONS } from "@/lib/valuation/presets"
import type { ValuationConfig, Assumptions } from "@/types/valuation"
import type { ComputedValuations } from "@/lib/valuation/calculations"

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
}

const SCENARIO_KEYS = ["Bear", "Base", "Bull"] as const
const SCENARIO_COLORS = { Bear: "#EF4444", Base: "#3B82F6", Bull: "#22C55E" }
const DEFAULT_WEIGHTS = { Bear: 25, Base: 50, Bull: 25 }

const MODELS: { key: keyof ComputedValuations; label: string }[] = [
  { key: "pps_fcff",   label: "FCFF (DCF)" },
  { key: "pps_fcfe",   label: "FCFE (DCF)" },
  { key: "pps_ri",     label: "Residual Income" },
  { key: "pps_ddm",    label: "DDM (2-Stage)" },
  { key: "pps_ebitda", label: "EV/EBITDA" },
  { key: "pps_pe",     label: "P/E" },
  { key: "pps_rev",    label: "Revenue" },
  { key: "pps_pcf",    label: "P/CF" },
]

function buildScenarioAssumptions(presetKey: "Bear" | "Base" | "Bull", base: Assumptions): Assumptions {
  const preset = SCENARIO_PRESETS[presetKey]
  return {
    ...base,
    ...preset,
    scenario: presetKey,
  }
}

export function ScenarioTab({ config, computed: _computed }: Props) {
  const B = config.baseline
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS })

  // Merge config's partial default_assumptions over DEFAULT_ASSUMPTIONS to get a complete base
  const baseAssumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS, ...config.default_assumptions }

  const scenarioComputed = useMemo(() => {
    const result: Record<string, ComputedValuations> = {}
    for (const s of SCENARIO_KEYS) {
      const a = buildScenarioAssumptions(s, baseAssumptions)
      result[s] = computeAll(
        B,
        config.comps,
        config.segments,
        config.acquisitions,
        config.historical_is.eps,
        a,
      )
    }
    return result
  }, [B, config.comps, config.segments, config.acquisitions, config.historical_is.eps, baseAssumptions])

  // Normalize weights to fractions
  const totalW = weights.Bear + weights.Base + weights.Bull
  const w = {
    Bear: weights.Bear / totalW,
    Base: weights.Base / totalW,
    Bull: weights.Bull / totalW,
  }

  // Probability-weighted consensus for each model
  const weightedValues: Record<string, number> = {}
  for (const { key, label } of MODELS) {
    const bear = Number(scenarioComputed.Bear[key] ?? 0)
    const base = Number(scenarioComputed.Base[key] ?? 0)
    const bull = Number(scenarioComputed.Bull[key] ?? 0)
    weightedValues[label] = bear * w.Bear + base * w.Base + bull * w.Bull
  }

  // Weighted FCFF consensus (primary)
  const wFcff  = weightedValues["FCFF (DCF)"]
  const allW   = Object.values(weightedValues).filter((v) => v > 0)
  const wMean  = allW.length ? allW.reduce((a, b) => a + b, 0) / allW.length : 0
  const upside = B.current_price > 0 ? ((wFcff / B.current_price) - 1) * 100 : 0

  // Waterfall chart data — shows FCFF value for each scenario + weighted
  const waterfallData = [
    ...SCENARIO_KEYS.map((s) => ({
      scenario: s,
      pps: Number(scenarioComputed[s].pps_fcff ?? 0),
      fill: SCENARIO_COLORS[s],
    })),
    { scenario: "Weighted", pps: wFcff, fill: "#A855F7" },
  ]

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground font-mono">
        Scenario Analysis — Bear / Base / Bull computed independently. Adjust probability weights below.
      </p>

      {/* Probability weights */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground">Probability Weights</p>
        <div className="grid grid-cols-3 gap-4">
          {SCENARIO_KEYS.map((s) => (
            <div key={s} className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium" style={{ color: SCENARIO_COLORS[s] }}>
                {s}: {weights[s]}%
              </label>
              <input
                type="range"
                min={5}
                max={90}
                step={5}
                value={weights[s]}
                onChange={(e) => setWeights((prev) => ({ ...prev, [s]: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: SCENARIO_COLORS[s] }}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Bear {(w.Bear * 100).toFixed(0)}% · Base {(w.Base * 100).toFixed(0)}% · Bull {(w.Bull * 100).toFixed(0)}% (normalised to 100%)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Bear FCFF"     value={fmtUsd(scenarioComputed.Bear.pps_fcff, 2)} />
        <MetricCard label="Base FCFF"     value={fmtUsd(scenarioComputed.Base.pps_fcff, 2)} />
        <MetricCard label="Bull FCFF"     value={fmtUsd(scenarioComputed.Bull.pps_fcff, 2)} />
        <MetricCard
          label="Weighted FCFF"
          value={fmtUsd(wFcff, 2)}
          delta={`${upside >= 0 ? "+" : ""}${upside.toFixed(1)}% vs market`}
          deltaPositive={upside >= 0}
        />
      </div>

      {/* FCFF bar chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">FCFF (DCF) Intrinsic Value by Scenario</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waterfallData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="scenario" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => fmtUsd(v, 0)} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
              formatter={(v: number) => [fmtUsd(v, 2), "Price / Share"]}
            />
            <Bar dataKey="pps" radius={[4, 4, 0, 0]}>
              {waterfallData.map((d) => <Cell key={d.scenario} fill={d.fill} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full model table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          All Models · Intrinsic Price / Share
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left text-xs text-muted-foreground">Model</th>
                <th className="px-4 py-2 text-right text-xs" style={{ color: SCENARIO_COLORS.Bear }}>Bear</th>
                <th className="px-4 py-2 text-right text-xs" style={{ color: SCENARIO_COLORS.Base }}>Base</th>
                <th className="px-4 py-2 text-right text-xs" style={{ color: SCENARIO_COLORS.Bull }}>Bull</th>
                <th className="px-4 py-2 text-right text-xs text-purple-400">Weighted</th>
                <th className="px-4 py-2 text-right text-xs text-muted-foreground">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MODELS.map(({ key, label }) => {
                const bear = Number(scenarioComputed.Bear[key] ?? 0)
                const base = Number(scenarioComputed.Base[key] ?? 0)
                const bull = Number(scenarioComputed.Bull[key] ?? 0)
                const wv   = bear * w.Bear + base * w.Base + bull * w.Bull
                const upPct = B.current_price > 0 && wv > 0 ? ((wv / B.current_price) - 1) * 100 : null
                const sig   = upPct === null || wv === 0 ? "N/A" : upPct > 15 ? "BUY" : upPct < -15 ? "SELL" : "HOLD"
                return (
                  <tr key={label} className="hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs font-sans text-muted-foreground">{label}</td>
                    <td className="px-4 py-2 text-right text-xs">{bear > 0 ? fmtUsd(bear, 2) : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-foreground">{base > 0 ? fmtUsd(base, 2) : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs">{bull > 0 ? fmtUsd(bull, 2) : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs text-purple-300 font-semibold">{wv > 0 ? fmtUsd(wv, 2) : "—"}</td>
                    <td className={`px-4 py-2 text-right text-xs font-bold ${sig === "BUY" ? "text-green-400" : sig === "SELL" ? "text-red-400" : "text-yellow-400"}`}>{sig}</td>
                  </tr>
                )
              })}
              {/* Weighted average row */}
              <tr className="bg-purple-500/5 border-t-2 border-purple-500/20">
                <td className="px-4 py-2 text-xs font-bold font-sans text-purple-300">Weighted Average</td>
                <td colSpan={3} className="px-4 py-2 text-center text-[10px] text-muted-foreground">
                  Bear {(w.Bear * 100).toFixed(0)}% / Base {(w.Base * 100).toFixed(0)}% / Bull {(w.Bull * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-2 text-right text-sm text-purple-300 font-bold">{fmtUsd(wMean, 2)}</td>
                <td className={`px-4 py-2 text-right text-xs font-bold ${wMean > B.current_price * 1.15 ? "text-green-400" : wMean < B.current_price * 0.85 ? "text-red-400" : "text-yellow-400"}`}>
                  {wMean === 0 ? "N/A" : wMean > B.current_price * 1.15 ? "BUY" : wMean < B.current_price * 0.85 ? "SELL" : "HOLD"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario assumptions recap */}
      <div className="rounded-lg border border-border overflow-hidden">
        <p className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
          Scenario Assumptions
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left text-muted-foreground">Parameter</th>
                {SCENARIO_KEYS.map((s) => (
                  <th key={s} className="px-4 py-2 text-right" style={{ color: SCENARIO_COLORS[s] }}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["WACC",             (a: typeof baseAssumptions) => fmtPct(a.wacc, 2)],
                ["Yr1 Growth",       (a: typeof baseAssumptions) => fmtPct(a.yr1_g, 1)],
                ["Yr3 Growth",       (a: typeof baseAssumptions) => fmtPct(a.yr3_g, 1)],
                ["Target EBITDA M.", (a: typeof baseAssumptions) => fmtPct(a.target_ebitda_m, 1)],
                ["Exit Multiple",    (a: typeof baseAssumptions) => `${a.exit_mult}×`],
                ["Terminal g",       (a: typeof baseAssumptions) => fmtPct(a.terminal_g, 2)],
              ].map(([label, fmt]) => (
                <tr key={String(label)} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground font-sans">{label as string}</td>
                  {SCENARIO_KEYS.map((s) => (
                    <td key={s} className="px-4 py-2 text-right text-foreground">
                      {(fmt as (a: typeof baseAssumptions) => string)(buildScenarioAssumptions(s, baseAssumptions))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
