"use client"

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet"
import { useScenario, ScenarioToggle } from "@/context/ScenarioContext"
import { computeWACC } from "@/lib/valuation/calculations"
import { cn } from "@/lib/utils"

// ── Field config ─────────────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  decimals: number
  group: string
  hint?: string
  readonly?: boolean
}

const FIELDS: FieldDef[] = [
  // CAPM inputs (editable)
  { key: "rf",           label: "Risk-Free Rate",    unit: "%", min: 0,    max: 8,    step: 0.05, decimals: 2, group: "CAPM Inputs", hint: "10-yr Treasury yield" },
  { key: "erp",          label: "Equity Risk Prem",  unit: "%", min: 3,    max: 10,   step: 0.25, decimals: 2, group: "CAPM Inputs", hint: "Expected market return over rf" },
  { key: "cost_of_debt", label: "Pre-Tax Cost of Debt", unit: "%", min: 1, max: 12, step: 0.25, decimals: 2, group: "CAPM Inputs" },
  { key: "hl",           label: "H-Model Half-Life", unit: "yr", min: 1,   max: 10,   step: 0.5,  decimals: 1, group: "CAPM Inputs", hint: "Years until growth fades to terminal" },
  { key: "beta",         label: "Beta",              unit: "×",  min: 0.1,  max: 3.0,  step: 0.05, decimals: 2, group: "CAPM Inputs", hint: "Market sensitivity; overrides live beta" },
  // Discount rates (manual override)
  { key: "wacc",          label: "WACC (manual)",          unit: "%", min: 3,  max: 20, step: 0.25, decimals: 2, group: "Discount Rates", hint: "Used for FCFF DCF; CAPM computed below" },
  { key: "cost_of_equity",label: "Cost of Equity (manual)",unit: "%", min: 3,  max: 20, step: 0.25, decimals: 2, group: "Discount Rates" },
  // Growth
  { key: "yr1_g",         label: "Year 1 Growth",    unit: "%", min: -5,  max: 25,   step: 0.5,  decimals: 1, group: "Revenue Growth" },
  { key: "yr2_g",         label: "Year 2 Growth",    unit: "%", min: -5,  max: 25,   step: 0.5,  decimals: 1, group: "Revenue Growth" },
  { key: "yr3_g",         label: "Year 3 Growth",    unit: "%", min: -5,  max: 25,   step: 0.5,  decimals: 1, group: "Revenue Growth" },
  { key: "lt_g",          label: "Long-term Growth", unit: "%", min: 0,   max: 10,   step: 0.25, decimals: 1, group: "Revenue Growth" },
  // Terminal
  { key: "terminal_g",    label: "Terminal Growth",  unit: "%", min: 0.5, max: 5,    step: 0.25, decimals: 2, group: "Terminal Value", hint: "Must be < WACC" },
  { key: "exit_mult",     label: "Exit EV/EBITDA",   unit: "×", min: 4,   max: 35,   step: 0.5,  decimals: 1, group: "Terminal Value" },
  // Margins
  { key: "target_ebitda_m", label: "Target EBITDA Margin", unit: "%", min: 5, max: 60, step: 0.5, decimals: 1, group: "Margins & Tax" },
  { key: "tax_rate",      label: "Tax Rate",         unit: "%", min: 0,   max: 40,   step: 0.5,  decimals: 1, group: "Margins & Tax", hint: "Affects NOPAT in DCF" },
  { key: "capex_pct",     label: "CapEx % Revenue",  unit: "%", min: 0.5, max: 15,   step: 0.25, decimals: 2, group: "Margins & Tax" },
]

const GROUPS = [...new Set(FIELDS.map((f) => f.group))]

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDisplay(key: string, raw: number): number {
  if (key === "exit_mult" || key === "beta" || key === "hl") return raw
  return raw * 100
}

function fromDisplay(key: string, display: number): number {
  if (key === "exit_mult" || key === "beta" || key === "hl") return display
  return display / 100
}

// ── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ field, rawValue, onChange }: {
  field: FieldDef
  rawValue: number
  onChange: (v: number) => void
}) {
  const display = toDisplay(field.key, rawValue)

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(fromDisplay(field.key, parseFloat(e.target.value)))
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) onChange(fromDisplay(field.key, v))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-foreground">{field.label}</label>
          {field.hint && (
            <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">{field.hint}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step={field.step}
            min={field.min}
            max={field.max}
            value={display.toFixed(field.decimals)}
            onChange={handleInput}
            className="w-16 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-right font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground w-4">{field.unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={display}
        onChange={handleSlider}
        className="w-full h-1 appearance-none bg-border rounded-full accent-blue-500 cursor-pointer"
      />
    </div>
  )
}

// ── Read-only display row for computed CAPM outputs ───────────────────────────

function ComputedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticker: string
  totalDebt?: number    // $M — for WACC calculation display
  marketCap?: number    // $M — for WACC calculation display
}

export function AssumptionsDrawer({ open, onOpenChange, ticker, totalDebt = 0, marketCap = 0 }: Props) {
  const { assumptions, setAssumption, applyScenario, scenario } = useScenario()

  const reset = () => applyScenario(scenario)

  // Live CAPM computation for display
  const { wacc: waccCalc, ke: keCalc, kd_after_tax: kdAt } = computeWACC(
    assumptions.rf ?? 0.043,
    assumptions.beta ?? 1.0,
    assumptions.erp ?? 0.055,
    assumptions.cost_of_debt ?? 0.045,
    assumptions.tax_rate ?? 0.21,
    marketCap,
    totalDebt,
  )

  const fmt = (v: number) => `${(v * 100).toFixed(2)}%`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 max-w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assumptions — {ticker}</SheetTitle>
          <SheetDescription>
            Changes apply instantly to all valuation outputs.
          </SheetDescription>
          <ScenarioToggle className="mt-2" />
        </SheetHeader>

        {/* Fields grouped by category */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {GROUPS.map((group) => (
            <section key={group} className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {group}
              </p>

              <div className="space-y-4">
                {FIELDS.filter((f) => f.group === group).map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    rawValue={((assumptions as unknown) as Record<string, number>)[field.key] ?? 0}
                    onChange={(v) => setAssumption(field.key as keyof typeof assumptions, v as never)}
                  />
                ))}
              </div>

              {/* After CAPM Inputs group: show computed outputs */}
              {group === "CAPM Inputs" && (
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    Computed CAPM Outputs
                  </p>
                  <ComputedRow label="Cost of Equity (ke = rf + β×ERP)" value={fmt(keCalc)} />
                  <ComputedRow label="After-tax Cost of Debt" value={fmt(kdAt)} />
                  <ComputedRow label={`WACC (E=${marketCap.toFixed(0)}M, D=${totalDebt.toFixed(0)}M)`} value={fmt(waccCalc)} />
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    These are read-only outputs. Use the WACC/ke sliders above to override.
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>

        <SheetFooter>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            Reset to {scenario}
          </button>
          <SheetClose className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
            Done
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
