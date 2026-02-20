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
  const [assumptions, setAssumptions] = useState<Assumptions>({
    ...DEFAULT_ASSUMPTIONS,
    // Seed live CAPM/tax fields from company config if provided
    ...(initial?.beta !== undefined && { beta: initial.beta }),
    ...(initial?.tax_rate !== undefined && { tax_rate: initial.tax_rate }),
    ...initial,
  })

  const applyScenario = useCallback((s: ScenarioKey) => {
    setAssumptions((prev) => ({
      ...prev,
      ...SCENARIO_PRESETS[s],
      scenario: s,
    }))
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
