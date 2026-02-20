export interface Baseline {
  revenue: number
  ebitda: number
  adj_ebitda: number
  adj_ebitda_margin: number
  ebitda_margin: number
  net_income: number
  adj_net_income: number
  fcf: number
  adj_eps: number
  eps: number
  dps: number
  current_price: number
  shares_diluted: number
  net_debt: number
  bvps: number
  roe: number
  total_debt: number
  total_equity: number
  total_assets: number
  goodwill: number
  tax_rate: number
  payout_ratio: number
  plowback_ratio: number
  gross_margin: number
  cogs: number
  gross_profit: number
  sga: number
  da_total: number
  operating_income: number
  interest_expense: number
  pretax_income: number
  tax: number
  // New XBRL-sourced fields
  ocf: number           // operating cash flow (millions)
  ebit: number          // EBIT = operating income (millions)
  shares_basic: number  // basic shares outstanding (millions)
  capex: number         // capital expenditures as positive (millions)
  net_borrowing: number // net new debt issued − repaid (millions)
}

export interface HistoricalIS {
  year: number[]
  revenue: number[]
  ebitda: number[]
  net_income: number[]
  eps: number[]
  dps: number[]
  // New XBRL-sourced historical series
  ocf: number[]
  capex: number[]
  bvps: number[]
}

export interface Segment {
  revenue: number
  adj_op_margin: number
}

export interface Comp {
  ev_ebitda: number
  ev_rev: number
  pe: number
  peg: number
  pb: number
  pcf: number  // P/CF multiple
}

export interface CAPMData {
  rf: number
  beta: number
  erp: number
  cost_of_debt: number
}

export interface ValuationConfig {
  ticker: string
  name: string
  exchange: string
  fiscal_year: string
  currency: string
  units: string
  baseline: Baseline
  historical_is: HistoricalIS
  segments: Record<string, Segment>
  acquisitions: Record<string, { rev: number; margin: number; mult: number; seg?: string }>
  comps: Record<string, Comp>
  capm: CAPMData
  default_assumptions: Partial<Assumptions>
  overview_metrics: { revenue_growth?: string; fcf_growth?: string; adj_eps_growth?: string }
  sources?: string
  disclaimer?: string
  pb_note?: string
  ev_chart_current_multiple?: number
}

export interface Assumptions {
  scenario: "Base" | "Bull" | "Bear"
  yr1_g: number
  yr2_g: number
  yr3_g: number
  lt_g: number
  terminal_g: number
  wacc: number
  cost_of_equity: number
  target_ebitda_m: number
  capex_pct: number
  exit_mult: number
  proj_years_n: number
  n_sims: number
  ddm_g: number
  // CAPM / balance sheet overrides (editable in AssumptionsDrawer)
  beta: number
  tax_rate: number
  // CAPM inputs (new)
  rf: number            // risk-free rate (e.g. 0.043)
  erp: number           // equity risk premium (e.g. 0.055)
  cost_of_debt: number  // pre-tax cost of debt (e.g. 0.045)
  hl: number            // H-Model DDM half-life (e.g. 2.5 years)
}

export type Signal = "BUY" | "HOLD" | "SELL" | "N/A"

export interface SignalRow {
  method: string
  intrinsicValue: number
  vsMarket: string
  signal: Signal
}

export interface ProFormaRow {
  year: number
  revenue: number
  cogs: number
  gross_profit: number
  sga: number
  da: number
  op_inc: number
  interest: number
  pretax: number
  tax: number
  net_income: number
  ebitda: number
  capex: number
  fcff: number
  fcfe: number
  dividends: number
  ebitda_margin: number
}

export interface RIProjectionRow {
  year: number
  bvps_start: number
  eps_proj: number
  required_return: number
  ri: number
  pv_ri: number
}

export interface NewsArticle {
  title: string
  summary?: string
  url?: string
  source?: string
  date?: string
  origin?: string
  category?: string
  sentiment?: "Positive" | "Negative" | "Neutral"
}
