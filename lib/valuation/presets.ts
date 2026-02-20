import type { Assumptions } from "@/types/valuation"

type PresetKey = "Base" | "Bull" | "Bear"
type PresetValues = Omit<Assumptions, "scenario" | "proj_years_n" | "n_sims" | "ddm_g">

export const SCENARIO_PRESETS: Record<PresetKey, PresetValues> = {
  Base: {
    yr1_g: 0.025,
    yr2_g: 0.035,
    yr3_g: 0.040,
    lt_g: 0.030,
    terminal_g: 0.025,
    wacc: 0.085,
    cost_of_equity: 0.085,
    target_ebitda_m: 0.270,
    capex_pct: 0.025,
    exit_mult: 14.0,
    beta: 1.0,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.045,
    hl: 2.5,
  },
  Bull: {
    yr1_g: 0.045,
    yr2_g: 0.055,
    yr3_g: 0.060,
    lt_g: 0.045,
    terminal_g: 0.030,
    wacc: 0.075,
    cost_of_equity: 0.075,
    target_ebitda_m: 0.300,
    capex_pct: 0.020,
    exit_mult: 17.0,
    beta: 0.85,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.040,
    hl: 2.5,
  },
  Bear: {
    yr1_g: 0.005,
    yr2_g: 0.010,
    yr3_g: 0.020,
    lt_g: 0.020,
    terminal_g: 0.020,
    wacc: 0.100,
    cost_of_equity: 0.100,
    target_ebitda_m: 0.230,
    capex_pct: 0.030,
    exit_mult: 11.0,
    beta: 1.2,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.050,
    hl: 2.5,
  },
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  ...SCENARIO_PRESETS.Base,
  scenario: "Base",
  proj_years_n: 5,
  n_sims: 5000,
  ddm_g: 0.035,
}

export const CHART_COLORS: Record<string, string> = {
  "FCFF (DCF)":      "#2563EB",
  "FCFE (DCF)":      "#0D9488",
  "Residual Income": "#7C3AED",
  "DDM (2-Stage)":   "#16A34A",
  "H-Model DDM":     "#059669",
  "EBITDA Multiple": "#DC2626",
  "Revenue Multiple":"#9333EA",
  "P/E Multiple":    "#EA580C",
  "Justified P/E":   "#B45309",
  "Justified P/B":   "#0369A1",
  PEG:               "#0891B2",
  "P/B":             "#CA8A04",
  "P/CF":            "#BE185D",
  SOTP:              "#BE185D",
}
