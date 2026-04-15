"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { SCENARIO_PRESETS, DEFAULT_ASSUMPTIONS } from "@/lib/valuation/presets"
import type { Assumptions } from "@/types/valuation"

// ── Types ────────────────────────────────────────────────────────────────────

export type ScenarioKey = "Base" | "Bull" | "Bear"

interface ScenarioState {
  scenario: ScenarioKey
  assumptions: Assumptions
  /** Replace individual assumptions without changing scenario label */
  setAssumption: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void
  /** Apply a full scenario preset, resetting all slider values */
  applyScenario: (s: ScenarioKey) => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const ScenarioContext = createContext<ScenarioState | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode
  /** Optional seed assumptions (e.g. from company config defaults) */
  initial?: Partial<Assumptions>
}

export function ScenarioProvider({ children, initial }: ProviderProps) {
  // Merge: DEFAULT_ASSUMPTIONS < SCENARIO_PRESETS.Base < company-specific initial
  // This ensures company-derived growth/exit_mult override the generic presets
  const baseAssumptions: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...initial,
    scenario: "Base",
  }

  const [assumptions, setAssumptions] = useState<Assumptions>(baseAssumptions)

  const applyScenario = useCallback((s: ScenarioKey) => {
    setAssumptions(() => {
      if (s === "Base") {
        // Base: restore the company-seeded defaults exactly
        return { ...baseAssumptions, scenario: "Base" }
      }

      // Bull / Bear: apply scenario multipliers on top of the company-seeded Base
      // so the scenario reflects THIS company's dynamics, not generic values.
      const base = baseAssumptions
      const multiplier = s === "Bull" ? 1.5 : 0.35  // Bull = +50% growth; Bear = -65% growth
      const waccDelta  = s === "Bull" ? -0.010 : +0.015
      const multDelta  = s === "Bull" ? +4.0   : -6.0

      return {
        ...base,
        ...SCENARIO_PRESETS[s],                       // take WACC, tax, CAPM from preset
        // Override growth with company-relative scaling
        yr1_g:     Math.min(0.60, Math.max(0.005, base.yr1_g * multiplier)),
        yr2_g:     Math.min(0.55, Math.max(0.005, base.yr2_g * multiplier)),
        yr3_g:     Math.min(0.50, Math.max(0.005, base.yr3_g * multiplier)),
        // Override exit multiple with peer-relative adjustment
        exit_mult: Math.max(4, (base.exit_mult ?? 18) + multDelta),
        wacc:      Math.max(0.05, base.wacc + waccDelta),
        scenario:  s,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setAssumption = useCallback(
    <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
      setAssumptions((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const value = useMemo<ScenarioState>(
    () => ({ scenario: assumptions.scenario, assumptions, setAssumption, applyScenario }),
    [assumptions, setAssumption, applyScenario],
  )

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useScenario(): ScenarioState {
  const ctx = useContext(ScenarioContext)
  if (!ctx) throw new Error("useScenario must be used inside <ScenarioProvider>")
  return ctx
}

// ── Scenario Toggle UI (self-contained, drop anywhere) ───────────────────────

const LABELS: Record<ScenarioKey, { label: string; active: string; text: string }> = {
  Base: { label: "Base", active: "bg-blue-500/20 border-blue-500/40 text-blue-400",  text: "text-blue-400" },
  Bull: { label: "Bull", active: "bg-buy/20 border-buy/40 text-buy",                 text: "text-buy" },
  Bear: { label: "Bear", active: "bg-sell/20 border-sell/40 text-sell",               text: "text-sell" },
}

interface ToggleProps {
  className?: string
}

export function ScenarioToggle({ className }: ToggleProps) {
  const { scenario, applyScenario } = useScenario()

  return (
    <div className={`inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5 ${className ?? ""}`}>
      {(["Base", "Bull", "Bear"] as ScenarioKey[]).map((s) => {
        const { label, active } = LABELS[s]
        const isActive = scenario === s
        return (
          <button
            key={s}
            onClick={() => applyScenario(s)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              isActive ? active : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
