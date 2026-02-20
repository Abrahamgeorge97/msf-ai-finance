"use client"

import { SCENARIO_PRESETS } from "@/lib/valuation/presets"
import type { Assumptions } from "@/types/valuation"
import { cn } from "@/lib/utils"

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="font-mono text-xs font-semibold text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        className="w-full h-1 appearance-none bg-border rounded-full accent-ring cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{title}</p>
      {children}
    </div>
  )
}

interface Props {
  ticker: string
  assumptions: Assumptions
  onChange: (a: Assumptions) => void
}

export function AssumptionsSidebar({ ticker, assumptions: a, onChange }: Props) {
  const set = <K extends keyof Assumptions>(key: K, val: Assumptions[K]) =>
    onChange({ ...a, [key]: val })

  const applyScenario = (s: "Base" | "Bull" | "Bear") => {
    onChange({ ...a, ...SCENARIO_PRESETS[s], scenario: s })
  }

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`
  const x = (v: number) => `${v.toFixed(1)}×`
  const yrs = (v: number) => `${v} yrs`
  const sims = (v: number) => v.toLocaleString()

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border">
        <p className="text-sm font-bold text-foreground">{ticker} — Assumptions</p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Scenario */}
        <Section title="Scenario">
          <div className="flex gap-1">
            {(["Base", "Bull", "Bear"] as const).map((s) => (
              <button
                key={s}
                onClick={() => applyScenario(s)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors border",
                  a.scenario === s
                    ? s === "Bull"
                      ? "bg-buy/20 border-buy/40 text-buy"
                      : s === "Bear"
                      ? "bg-sell/20 border-sell/40 text-sell"
                      : "bg-ring/20 border-ring/40 text-blue-400"
                    : "bg-transparent border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>

        {/* Growth */}
        <Section title="Growth">
          <Slider label="Year 1" value={a.yr1_g} min={-0.02} max={0.10} step={0.005} format={pct} onChange={(v) => set("yr1_g", v)} />
          <Slider label="Year 2" value={a.yr2_g} min={-0.02} max={0.10} step={0.005} format={pct} onChange={(v) => set("yr2_g", v)} />
          <Slider label="Year 3" value={a.yr3_g} min={-0.02} max={0.10} step={0.005} format={pct} onChange={(v) => set("yr3_g", v)} />
          <Slider label="Long-term" value={a.lt_g} min={0} max={0.08} step={0.005} format={pct} onChange={(v) => set("lt_g", v)} />
          <Slider label="Terminal" value={a.terminal_g} min={0.01} max={0.04} step={0.0025} format={pct} onChange={(v) => set("terminal_g", v)} />
          <Slider label="Projection" value={a.proj_years_n} min={3} max={10} step={1} format={yrs} onChange={(v) => set("proj_years_n", v)} />
        </Section>

        {/* Discount */}
        <Section title="Discount Rate">
          <Slider label="WACC" value={a.wacc} min={0.05} max={0.14} step={0.0025} format={pct} onChange={(v) => set("wacc", v)} />
          <Slider label="Cost of Equity" value={a.cost_of_equity} min={0.05} max={0.16} step={0.0025} format={pct} onChange={(v) => set("cost_of_equity", v)} />
        </Section>

        {/* Margins */}
        <Section title="Margins & CapEx">
          <Slider label="Target EBITDA Margin" value={a.target_ebitda_m} min={0.10} max={0.45} step={0.005} format={pct} onChange={(v) => set("target_ebitda_m", v)} />
          <Slider label="CapEx % Revenue" value={a.capex_pct} min={0.005} max={0.08} step={0.0025} format={pct} onChange={(v) => set("capex_pct", v)} />
          <Slider label="Exit EV/EBITDA" value={a.exit_mult} min={6} max={30} step={0.5} format={x} onChange={(v) => set("exit_mult", v)} />
        </Section>

        {/* Monte Carlo */}
        <Section title="Monte Carlo">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Simulations</p>
            <div className="flex gap-1">
              {[1000, 5000, 10000].map((n) => (
                <button
                  key={n}
                  onClick={() => set("n_sims", n)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-semibold border transition-colors",
                    a.n_sims === n
                      ? "bg-ring/20 border-ring/40 text-blue-400"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Scenario: <span className="font-semibold text-foreground">{a.scenario}</span>
        </p>
      </div>
    </aside>
  )
}
