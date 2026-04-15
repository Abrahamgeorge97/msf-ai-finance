import type { Assumptions } from "@/types/valuation"

type PresetKey = "Base" | "Bull" | "Bear"
type PresetValues = Omit<Assumptions, "scenario" | "proj_years_n" | "n_sims" | "ddm_g">

// NOTE: yr1_g, yr2_g, yr3_g, and exit_mult are intentionally NOT set here.
// Those are seeded company-specifically from historical XBRL data and peer comps
// by yahooFetcher.ts → default_assumptions.  The scenario toggle applies
// a +/- delta on top of whatever base the company's data produced.
// Only set them here as a last-resort fallback (no historical data available).
export const SCENARIO_PRESETS: Record<PresetKey, PresetValues> = {
  Base: {
    yr1_g: 0.06,    // fallback only — overridden by historical data
    yr2_g: 0.05,
    yr3_g: 0.04,
    lt_g: 0.030,
    terminal_g: 0.025,
    wacc: 0.085,
    cost_of_equity: 0.085,
    target_ebitda_m: 0.270,
    capex_pct: 0.025,
    exit_mult: 18.0,  // fallback: current S&P median ~18-20x EV/EBITDA
    beta: 1.0,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.045,
    hl: 2.5,
    nwc_pct_rev: 0.03,
  },
  Bull: {
    yr1_g: 0.10,
    yr2_g: 0.085,
    yr3_g: 0.07,
    lt_g: 0.045,
    terminal_g: 0.030,
    wacc: 0.075,
    cost_of_equity: 0.075,
    target_ebitda_m: 0.300,
    capex_pct: 0.020,
    exit_mult: 22.0,
    beta: 0.85,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.040,
    hl: 2.5,
    nwc_pct_rev: 0.03,
  },
  Bear: {
    yr1_g: 0.01,
    yr2_g: 0.02,
    yr3_g: 0.025,
    lt_g: 0.020,
    terminal_g: 0.020,
    wacc: 0.100,
    cost_of_equity: 0.100,
    target_ebitda_m: 0.230,
    capex_pct: 0.030,
    exit_mult: 12.0,
    beta: 1.2,
    tax_rate: 0.21,
    // CAPM inputs
    rf: 0.043,
    erp: 0.055,
    cost_of_debt: 0.050,
    hl: 2.5,
    nwc_pct_rev: 0.03,
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
