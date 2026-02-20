import type { Baseline, Assumptions, ProFormaRow, Signal, SignalRow, RIProjectionRow } from "@/types/valuation"

export function buildGrowthSchedule(a: Assumptions): number[] {
  const { yr1_g, yr2_g, yr3_g, lt_g, proj_years_n } = a
  return Array.from({ length: proj_years_n }, (_, i) => {
    if (i === 0) return yr1_g
    if (i === 1) return yr2_g
    if (i === 2) return yr3_g
    const fade = (i - 2) / Math.max(proj_years_n - 3, 1)
    return yr3_g + fade * (lt_g - yr3_g)
  })
}

export function buildProforma(
  B: Baseline,
  growthRates: number[],
  a: Assumptions,
): ProFormaRow[] {
  const cogs_pct = B.revenue ? B.cogs / B.revenue : 0.55
  const sga_pct = B.revenue ? B.sga / B.revenue : 0.20
  const da_pct = B.revenue ? B.da_total / B.revenue : 0.03
  const int_pct = B.revenue ? B.interest_expense / B.revenue : 0.025

  return growthRates.map((_, i) => {
    const rev = B.revenue * growthRates.slice(0, i + 1).reduce((acc, g) => acc * (1 + g), 1)
    const marginProg = (i + 1) / growthRates.length
    const ebitdaM = B.ebitda_margin + marginProg * (a.target_ebitda_m - B.ebitda_margin)
    const cogs = rev * cogs_pct
    const gp = rev - cogs
    const sga = rev * sga_pct
    const op_inc = gp - sga
    const da = rev * da_pct
    const ebitda = op_inc + da
    const interest = rev * int_pct
    const pretax = op_inc - interest
    const tax = pretax > 0 ? pretax * B.tax_rate : 0
    const ni = pretax - tax
    const capex = rev * a.capex_pct
    const fcff = op_inc * (1 - B.tax_rate) + da - capex
    const fcfe = fcff - interest * (1 - B.tax_rate)
    const dividends = ni > 0 ? ni * B.payout_ratio : 0

    return {
      year: 2025 + i,
      revenue: rev,
      cogs,
      gross_profit: gp,
      sga,
      da,
      op_inc,
      interest,
      pretax,
      tax,
      net_income: ni,
      ebitda,
      capex,
      fcff,
      fcfe,
      dividends,
      ebitda_margin: rev ? ebitda / rev : 0,
    }
  })
}

export function dcfPrice(
  fcfs: number[],
  terminalVal: number,
  discountRate: number,
  netDebt: number,
  shares: number,
): { pps: number; ev: number; pvFcfs: number; pvTv: number } {
  const dfs = fcfs.map((_, i) => 1 / (1 + discountRate) ** (i + 1))
  const pvFcfs = fcfs.reduce((acc, f, i) => acc + f * dfs[i], 0)
  const pvTv = terminalVal * dfs[dfs.length - 1]
  const ev = pvFcfs + pvTv
  const pps = shares ? (ev - netDebt) / shares : 0
  return { pps, ev, pvFcfs, pvTv }
}

export function assignSignal(intrinsic: number, market: number): Signal {
  if (!market || market <= 0) return "N/A"
  if (intrinsic > market * 1.15) return "BUY"
  if (intrinsic < market * 0.85) return "SELL"
  return "HOLD"
}

export function fmtUsd(n: number, decimals = 0): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}

// ── CFA-Standard Valuation Functions ─────────────────────────────────────────

/**
 * CFA L1: WACC = (E/V) × ke + (D/V) × kd × (1-T)
 * ke = rf + β × ERP  (CAPM)
 */
export function computeWACC(
  rf: number,
  beta: number,
  erp: number,
  kd: number,
  T: number,
  marketCapE: number,    // equity market value ($M)
  totalDebtD: number,    // total debt ($M)
): { wacc: number; ke: number; kd_after_tax: number } {
  const ke = rf + beta * erp
  const kd_after_tax = kd * (1 - T)
  const V = marketCapE + totalDebtD
  if (V <= 0) return { wacc: ke, ke, kd_after_tax }
  const wacc = (marketCapE / V) * ke + (totalDebtD / V) * kd_after_tax
  return { wacc, ke, kd_after_tax }
}

/**
 * CFA L2: FCFE DCF
 * FCFE_t = FCFF_t - Interest_t × (1-T) + NetBorrowing_t
 * TV = FCFE_n × (1+g) / (ke - g)
 * Price = [Σ PV(FCFE_t) + PV(TV)] / shares_diluted
 */
export function computeFCFE(
  proforma: ProFormaRow[],
  B: Baseline,
  a: Assumptions,
  ke: number,
): { pps_fcfe: number; ev_fcfe: number; fcfes: number[] } {
  const T = a.tax_rate || B.tax_rate
  const netBorrowPerYear = B.net_borrowing / Math.max(proforma.length, 1)
  const fcfes = proforma.map((r) => r.fcff - r.interest * (1 - T) + netBorrowPerYear)
  const g = a.terminal_g
  const n = proforma.length
  if (ke <= g) return { pps_fcfe: 0, ev_fcfe: 0, fcfes }

  const tv = (fcfes[n - 1] * (1 + g)) / (ke - g)
  const pvFcfes = fcfes.reduce((acc, f, i) => acc + f / (1 + ke) ** (i + 1), 0)
  const pvTv = tv / (1 + ke) ** n
  const equityValue = pvFcfes + pvTv
  const pps_fcfe = B.shares_diluted > 0 ? equityValue / B.shares_diluted : 0

  // ev_fcfe = equity value + net debt (approximate EV)
  const ev_fcfe = equityValue + B.net_debt
  return { pps_fcfe, ev_fcfe, fcfes }
}

/**
 * CFA L2: Residual Income Model (Clean Surplus)
 * RI_t = EPS_t - ke × B_{t-1}
 * B_t  = B_{t-1} + EPS_t × plowback
 * V₀   = B₀ + Σ PV(RI_t) + PV(Terminal RI)
 */
export function computeRI(
  B: Baseline,
  a: Assumptions,
  ke: number,
): { pps_ri: number; riRows: RIProjectionRow[] } {
  if (B.eps <= 0 || B.bvps <= 0 || ke <= 0) {
    return { pps_ri: 0, riRows: [] }
  }

  const plowback = B.plowback_ratio > 0 ? B.plowback_ratio : 1 - B.payout_ratio
  const growthRates = buildGrowthSchedule(a)
  const n = growthRates.length
  const g = a.terminal_g

  const riRows: RIProjectionRow[] = []
  let bvps_t = B.bvps
  let sumPvRi = 0
  let eps_t = B.eps

  for (let i = 0; i < n; i++) {
    eps_t = eps_t * (1 + growthRates[i])
    const required_return = ke * bvps_t
    const ri = eps_t - required_return
    const pv_ri = ri / (1 + ke) ** (i + 1)
    riRows.push({
      year: 2025 + i,
      bvps_start: bvps_t,
      eps_proj: eps_t,
      required_return,
      ri,
      pv_ri,
    })
    sumPvRi += pv_ri
    bvps_t = bvps_t + eps_t * plowback
  }

  // Terminal RI: RI_n × (1+g) / (ke - g)
  const ri_terminal = ke > g ? (riRows[n - 1].ri * (1 + g)) / (ke - g) : 0
  const pv_terminal_ri = ri_terminal / (1 + ke) ** n

  const pps_ri = B.bvps + sumPvRi + pv_terminal_ri
  return { pps_ri, riRows }
}

/**
 * CFA L2: H-Model DDM
 * P₀ = D₀(1+gL)/(r-gL)  +  D₀×H×(gS-gL)/(r-gL)
 * H = half-life of high growth period
 */
export function computeHModelDDM(
  B: Baseline,
  a: Assumptions,
  ke: number,
): number {
  const D0 = B.dps
  const gL = a.terminal_g
  const gS = a.yr1_g
  const H = a.hl ?? 2.5
  const r = ke

  if (D0 <= 0 || r <= gL) return 0

  const p0 = (D0 * (1 + gL)) / (r - gL) + (D0 * H * (gS - gL)) / (r - gL)
  return Math.max(0, p0)
}

/**
 * CFA L2: Justified P/E
 * Justified P/E = (1-b) / (r-g)
 * g = ROE × b
 * Price = Justified P/E × forward EPS
 */
export function computeJustifiedPE(
  B: Baseline,
  a: Assumptions,
  ke: number,
): { pps_jpe: number; justifiedPE: number } {
  const roe = B.roe > 0 ? B.roe : 0.10
  const b = B.plowback_ratio > 0 ? B.plowback_ratio : 1 - B.payout_ratio
  const g = Math.min(roe * b, ke - 0.001) // g must be < r
  const r = ke

  if (r <= g) return { pps_jpe: 0, justifiedPE: 0 }

  const payout = 1 - b
  const justifiedPE = payout / (r - g)
  const forwardEps = B.eps * (1 + a.yr1_g)
  const pps_jpe = justifiedPE * forwardEps

  return { pps_jpe, justifiedPE }
}

/**
 * CFA L2: Justified P/B
 * Justified P/B = (ROE - g) / (r - g)
 * g = ROE × plowback
 */
export function computeJustifiedPB(
  B: Baseline,
  a: Assumptions,
  ke: number,
): { pps_jpb: number; justifiedPB: number } {
  const roe = B.roe > 0 ? B.roe : 0.10
  const b = B.plowback_ratio > 0 ? B.plowback_ratio : 1 - B.payout_ratio
  const g = Math.min(roe * b, ke - 0.001)
  const r = ke

  if (r <= g || B.bvps <= 0) return { pps_jpb: 0, justifiedPB: 0 }

  const justifiedPB = (roe - g) / (r - g)
  const pps_jpb = justifiedPB * B.bvps

  return { pps_jpb, justifiedPB }
}

/**
 * CFA L1: P/CF Multiple
 * CFO per share = ocf / shares_diluted
 * Price = median P/CF × CFO per share
 */
export function computePCF(
  B: Baseline,
  medianPcf: number,
): { pps_pcf: number; cfoPerShare: number } {
  if (B.shares_diluted <= 0 || B.ocf <= 0) return { pps_pcf: 0, cfoPerShare: 0 }
  const cfoPerShare = B.ocf / B.shares_diluted
  const pps_pcf = medianPcf * cfoPerShare
  return { pps_pcf, cfoPerShare }
}

// ── Extended ComputedValuations ────────────────────────────────────────────────

export interface ComputedValuations {
  // Core DCF
  pps_fcff: number
  ev_fcff: number
  pvFcfs: number
  pvTv: number
  // New models
  pps_fcfe: number
  ev_fcfe: number
  pps_ri: number
  pps_hddm: number
  pps_jpe: number
  pps_jpb: number
  pps_pcf: number
  // CAPM outputs (read-only computed)
  wacc_calc: number
  ke_calc: number
  kd_after_tax: number
  // Multiples (existing)
  pps_ddm: number
  pps_ebitda: number
  pps_rev: number
  pps_pe: number
  pps_peg: number
  pps_pb: number
  pps_sotp: number
  // Justified multiples
  justifiedPE: number
  justifiedPB: number
  cfoPerShare: number
  // RI detail
  riRows: RIProjectionRow[]
  // Summary
  signalRows: SignalRow[]
  finalSignal: Signal
  buys: number
  holds: number
  sells: number
  medianPE: number
  medianEvm: number
  medianEvRev: number
  medianPeg: number
  medianPb: number
  medianPcf: number
  epsCAGR: number
  proforma: ProFormaRow[]
  growthSchedule: number[]
  sotvEV: number
}

export function computeAll(
  B: Baseline,
  comps: Record<string, { ev_ebitda: number; ev_rev: number; pe: number; peg: number; pb: number; pcf?: number }>,
  segments: Record<string, { revenue: number; adj_op_margin: number }>,
  acquisitions: Record<string, { rev: number; margin: number; mult: number }>,
  histEPS: number[],
  a: Assumptions,
): ComputedValuations {
  // Peer medians
  const compArr = Object.values(comps)
  const median = (arr: number[]) => {
    const s = [...arr].filter(isFinite).sort((x, y) => x - y)
    if (s.length === 0) return 0
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const medianPE    = median(compArr.map((c) => c.pe))
  const medianEvm   = median(compArr.map((c) => c.ev_ebitda))
  const medianEvRev = median(compArr.map((c) => c.ev_rev))
  const medianPeg   = median(compArr.map((c) => c.peg))
  const medianPb    = median(compArr.map((c) => c.pb))
  const medianPcf   = median(compArr.map((c) => c.pcf ?? 15))

  // EPS CAGR
  const epsCAGR =
    histEPS.length >= 2 && histEPS[0] > 0
      ? (histEPS[histEPS.length - 1] / histEPS[0]) ** (1 / Math.max(histEPS.length - 1, 1)) - 1
      : 0.05

  const growthSchedule = buildGrowthSchedule(a)
  const proforma = buildProforma(B, growthSchedule, a)
  const fcffs = proforma.map((r) => r.fcff)
  const lastEbitda = proforma[proforma.length - 1].ebitda

  // ── WACC (CFA CAPM) ──────────────────────────────────────────────────────
  const marketCap = B.current_price * B.shares_diluted
  const { wacc: wacc_calc, ke: ke_calc, kd_after_tax } = computeWACC(
    a.rf ?? 0.043,
    a.beta ?? 1.0,
    a.erp ?? 0.055,
    a.cost_of_debt ?? 0.045,
    a.tax_rate ?? B.tax_rate,
    marketCap,
    B.total_debt,
  )
  // Use CAPM-derived ke for all CFA L2 models (override cost_of_equity from drawer)
  const ke = ke_calc > 0 ? ke_calc : a.cost_of_equity

  // ── FCFF DCF ─────────────────────────────────────────────────────────────
  const tvFcff =
    a.wacc > a.terminal_g
      ? (fcffs[fcffs.length - 1] * (1 + a.terminal_g)) / (a.wacc - a.terminal_g)
      : lastEbitda * a.exit_mult
  const { pps: pps_fcff, ev: ev_fcff, pvFcfs, pvTv } = dcfPrice(fcffs, tvFcff, a.wacc, B.net_debt, B.shares_diluted)

  // ── DDM 2-stage ──────────────────────────────────────────────────────────
  const divProj = proforma.map((r) => (B.shares_diluted ? r.dividends / B.shares_diluted : 0))
  const pvDivs = divProj.reduce((acc, d, i) => acc + d / (1 + a.cost_of_equity) ** (i + 1), 0)
  const finalDiv = divProj[divProj.length - 1] * (1 + a.terminal_g)
  const tvDdm = a.cost_of_equity > a.terminal_g ? finalDiv / (a.cost_of_equity - a.terminal_g) : 0
  const pvTvDdm = tvDdm / (1 + a.cost_of_equity) ** a.proj_years_n
  const pps_ddm = B.dps > 0 ? pvDivs + pvTvDdm : 0

  // ── Multiples ─────────────────────────────────────────────────────────────
  const pps_ebitda = B.shares_diluted ? (B.adj_ebitda * medianEvm - B.net_debt) / B.shares_diluted : 0
  const pps_rev = B.shares_diluted ? (B.revenue * medianEvRev - B.net_debt) / B.shares_diluted : 0
  const pps_pe = medianPE * B.adj_eps
  const pegGrowth = epsCAGR > 0 ? epsCAGR : 0.05
  const pps_peg = medianPeg * pegGrowth * 100 * B.adj_eps
  const pps_pb = medianPb * B.bvps

  // ── SOTP ──────────────────────────────────────────────────────────────────
  const sotvEV = Object.keys(acquisitions).length
    ? Object.values(acquisitions).reduce((sum, d) => sum + d.rev * d.margin * d.mult, 0)
    : B.adj_ebitda * medianEvm
  const pps_sotp = B.shares_diluted ? (sotvEV - B.net_debt) / B.shares_diluted : 0

  // ── New CFA models ────────────────────────────────────────────────────────
  const { pps_fcfe, ev_fcfe } = computeFCFE(proforma, B, a, ke)
  const { pps_ri, riRows } = computeRI(B, a, ke)
  const pps_hddm = computeHModelDDM(B, a, ke)
  const { pps_jpe, justifiedPE } = computeJustifiedPE(B, a, ke)
  const { pps_jpb, justifiedPB } = computeJustifiedPB(B, a, ke)
  const { pps_pcf, cfoPerShare } = computePCF(B, medianPcf)

  // ── Signal table ──────────────────────────────────────────────────────────
  const signalValues: Record<string, number> = {
    "FCFF (DCF)":      pps_fcff,
    "FCFE (DCF)":      pps_fcfe,
    "Residual Income": pps_ri,
    "DDM (2-Stage)":   pps_ddm,
    "H-Model DDM":     pps_hddm,
    "EBITDA Multiple": pps_ebitda,
    "Revenue Multiple":pps_rev,
    "P/E Multiple":    pps_pe,
    "Justified P/E":   pps_jpe,
    "Justified P/B":   pps_jpb,
    PEG:               pps_peg,
    "P/B":             pps_pb,
    "P/CF":            pps_pcf,
    SOTP:              pps_sotp,
  }

  // Filter out zero-value models (N/A — missing data)
  const signalRows: SignalRow[] = Object.entries(signalValues)
    .filter(([, v]) => v > 0)
    .map(([method, v]) => ({
      method,
      intrinsicValue: v,
      vsMarket: B.current_price > 0 ? `${(((v / B.current_price) - 1) * 100).toFixed(1)}%` : "N/A",
      signal: assignSignal(v, B.current_price),
    }))

  const counts = signalRows.reduce(
    (acc, r) => {
      if (r.signal !== "N/A") acc[r.signal] = (acc[r.signal] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const finalSignal = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Signal) ?? "HOLD"

  return {
    pps_fcff, ev_fcff, pvFcfs, pvTv,
    pps_fcfe, ev_fcfe,
    pps_ri, riRows,
    pps_hddm,
    pps_jpe, justifiedPE,
    pps_jpb, justifiedPB,
    pps_pcf, cfoPerShare,
    wacc_calc, ke_calc, kd_after_tax,
    pps_ddm, pps_ebitda, pps_rev, pps_pe, pps_peg, pps_pb, pps_sotp,
    signalRows, finalSignal,
    buys: counts.BUY ?? 0, holds: counts.HOLD ?? 0, sells: counts.SELL ?? 0,
    medianPE, medianEvm, medianEvRev, medianPeg, medianPb, medianPcf,
    epsCAGR, proforma, growthSchedule, sotvEV,
  }
}
