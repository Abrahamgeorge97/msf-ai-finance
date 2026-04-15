/**
 * Server-only module. Do NOT import in client components.
 * Fetches SEC EDGAR XBRL companyfacts API and extracts structured GAAP data
 * directly from 10-K filings — the authoritative source for all fundamental data.
 */

const EDGAR_UA = "MSF-AI-Finance contact@msf.ai"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface XbrlUnit {
  accn: string
  cik: number
  entityName: string
  loc: string
  end: string
  val: number
  form?: string
  filed?: string
  fy?: string | number
  fp?: string
  frame?: string
  start?: string
}

interface XbrlConcept {
  label: string
  description: string
  units: Record<string, XbrlUnit[]>
}

interface XbrlCompanyFacts {
  cik: number
  entityName: string
  facts: {
    "us-gaap"?: Record<string, XbrlConcept>
    dei?: Record<string, XbrlConcept>
  }
}

/** LTM (Last Twelve Months) figures — available when a recent 10-Q extends beyond last 10-K. */
export interface LtmData {
  revenue: number       // LTM revenue (millions)
  ebit: number          // LTM EBIT (millions)
  net_income: number    // LTM net income (millions)
  da_total: number      // LTM D&A (millions)
  gross_profit: number  // LTM gross profit (millions)
  ocf: number           // LTM operating cash flow (millions)
  capex: number         // LTM capex (millions, positive)
  ebitda: number        // LTM EBITDA = ebit + da_total (millions)
  endDate: string       // ISO date of most recent quarter end, e.g. "2025-09-30"
  quartersAhead: number // quarters beyond last annual (1 = Q1, 2 = Q2, 3 = Q3)
}

export interface XbrlFundamentals {
  // Current-period figures (millions unless noted)
  revenue: number
  ebit: number
  net_income: number
  interest_expense: number
  tax_expense: number
  da_total: number
  eps_diluted: number
  dps: number
  gross_profit: number

  // Balance sheet (millions)
  total_assets: number
  total_debt: number
  cash: number
  total_equity: number
  goodwill: number
  intangibles: number

  // Share data (millions of shares)
  shares_diluted: number
  shares_basic: number
  bvps: number            // book value per share (dollars)

  // Cash flow (millions)
  ocf: number
  capex: number
  net_borrowing: number

  // Derived
  ebitda: number          // = ebit + da_total
  net_debt: number        // = total_debt - cash
  tax_rate: number        // clamped 0–0.5
  payout_ratio: number    // = dps / eps_diluted

  // LTM data (undefined if no recent 10-Q available beyond last 10-K)
  ltm?: LtmData

  // Historical arrays (oldest → newest, up to 5 years)
  hist: {
    year: number[]
    revenue: number[]
    ebit: number[]
    net_income: number[]
    eps_diluted: number[]
    dps: number[]
    ocf: number[]
    capex: number[]
    bvps: number[]
    da: number[]   // per-year D&A (millions); may be 0 if XBRL concept absent
  }

  cik: string
  filedDate: string
  fiscalYearEnd: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeN(v: unknown, fallback = 0): number {
  const x = Number(v)
  return isFinite(x) ? x : fallback
}

/** Returns true if the form is an annual 10-K filing */
function isAnnualForm(form?: string): boolean {
  return form === "10-K" || form === "10-K/A" || form === "20-F" || form === "40-F"
}

/** Filter XBRL unit entries to annual IS/CF items (10-K form, 330–400 day duration). */
// exported for unit testing
export function pickAnnual(values: XbrlUnit[]): XbrlUnit[] {
  const annuals = values.filter((v) => {
    if (!isAnnualForm(v.form)) return false
    if (!v.start || !v.end) return false
    const days = (new Date(v.end).getTime() - new Date(v.start).getTime()) / 86_400_000
    return days >= 300 && days <= 400
  })

  // Deduplicate: keep one entry per fiscal year-end, preferring latest filed
  const byYearEnd = new Map<string, XbrlUnit>()
  for (const entry of annuals) {
    const existing = byYearEnd.get(entry.end)
    if (!existing || (entry.filed ?? "") > (existing.filed ?? "")) {
      byYearEnd.set(entry.end, entry)
    }
  }

  return [...byYearEnd.values()].sort((a, b) => a.end.localeCompare(b.end))
}

/** Filter XBRL unit entries to instant (balance sheet) items matching a set of fiscal year-end dates. */
function pickInstant(values: XbrlUnit[], fyEnds: string[]): XbrlUnit[] {
  const results: XbrlUnit[] = []
  for (const fyEnd of fyEnds) {
    const fyDate = new Date(fyEnd).getTime()
    // Find entries within ±7 days of the fiscal year end date
    const candidates = values.filter((v) => {
      if (!isAnnualForm(v.form)) return false
      if (!v.end) return false
      const diff = Math.abs(new Date(v.end).getTime() - fyDate)
      return diff <= 7 * 86_400_000
    })
    // Pick the most recently filed
    if (candidates.length > 0) {
      candidates.sort((a, b) => ((b.filed ?? "") > (a.filed ?? "") ? 1 : -1))
      results.push({ ...candidates[0], end: fyEnd }) // normalize end date
    } else {
      // Push a zero placeholder so array lengths stay aligned
      results.push({ end: fyEnd, val: 0, accn: "", cik: 0, entityName: "", loc: "" })
    }
  }
  return results
}

/** Try concept names in order, return the annual series for the first match. */
// exported for unit testing
export function firstConcept(
  gaap: Record<string, XbrlConcept>,
  names: string[],
  unit: "USD" | "shares" | "USD/shares" = "USD",
): XbrlUnit[] {
  for (const name of names) {
    const concept = gaap[name]
    if (!concept) continue
    const vals = concept.units[unit]
    if (!vals || vals.length === 0) continue
    const annual = pickAnnual(vals)
    if (annual.length > 0) return annual
  }
  return []
}

/** Same as firstConcept but for instant (balance sheet) facts. */
function firstConceptInstant(
  gaap: Record<string, XbrlConcept>,
  names: string[],
  fyEnds: string[],
  unit: "USD" | "shares" = "USD",
): number[] {
  for (const name of names) {
    const concept = gaap[name]
    if (!concept) continue
    const vals = concept.units[unit]
    if (!vals || vals.length === 0) continue
    const instant = pickInstant(vals, fyEnds)
    if (instant.some((v) => v.val !== 0)) {
      return instant.map((v) => v.val)
    }
  }
  return fyEnds.map(() => 0)
}

// ── LTM helpers ───────────────────────────────────────────────────────────────

/**
 * Returns all XBRL unit entries for the first matching concept name.
 * Unlike firstConcept, this does NOT filter to annual-only entries.
 */
function allConceptValues(
  gaap: Record<string, XbrlConcept>,
  names: string[],
  unit: "USD" | "shares" | "USD/shares" = "USD",
): XbrlUnit[] {
  for (const name of names) {
    const c = gaap[name]
    if (!c) continue
    const vals = c.units[unit]
    if (vals && vals.length > 0) return vals
  }
  return []
}

/**
 * Find the most recent 10-Q YTD entry for a concept.
 * For each distinct quarter-end date, picks the longest duration entry (= YTD, not single quarter).
 * Q1 YTD ≈ 90d, Q2 YTD ≈ 180d, Q3 YTD ≈ 270d.
 */
function latestQtdYtd(vals: XbrlUnit[]): { entry: XbrlUnit; dur: number } | null {
  const q = vals.filter((v) => v.form === "10-Q" && v.start && v.end)
  if (q.length === 0) return null

  // Group by end date, keep the longest-duration entry per group
  const byEnd = new Map<string, { entry: XbrlUnit; dur: number }>()
  for (const v of q) {
    const dur = (new Date(v.end).getTime() - new Date(v.start!).getTime()) / 86_400_000
    if (dur < 75 || dur > 290) continue  // exclude nonsensical durations
    const ex = byEnd.get(v.end)
    if (!ex || dur > ex.dur) byEnd.set(v.end, { entry: v, dur })
  }

  if (byEnd.size === 0) return null

  // Return the entry with the most recent end date
  const sorted = [...byEnd.values()].sort((a, b) =>
    b.entry.end.localeCompare(a.entry.end),
  )
  return sorted[0]
}

/**
 * Compute LTM (Last Twelve Months) raw value for a single flow concept.
 * Formula: LTM = Last Annual + Current YTD - Prior Year same YTD.
 * Returns null if there is no recent 10-Q or if prior-year YTD cannot be matched.
 */
function ltmVal(
  annualArr: XbrlUnit[],  // pickAnnual output (sorted oldest→newest)
  allArr: XbrlUnit[],      // all XBRL entries for this concept
  lastAnnualEnd: string,
): number | null {
  if (annualArr.length === 0 || allArr.length === 0) return null

  const latest = latestQtdYtd(allArr)
  if (!latest) return null
  if (latest.entry.end <= lastAnnualEnd) return null  // no quarterly data beyond last 10-K

  const lastAnn = annualArr[annualArr.length - 1]
  const { entry: curr, dur } = latest

  // Locate the prior-year YTD entry (same duration ±25d, end date ≈1 year before curr.end)
  const priorTarget = new Date(curr.end)
  priorTarget.setFullYear(priorTarget.getFullYear() - 1)

  const q = allArr.filter((v) => v.form === "10-Q" && v.start && v.end)
  let best: XbrlUnit | null = null
  let bestScore = Infinity

  for (const v of q) {
    const vDur = (new Date(v.end).getTime() - new Date(v.start!).getTime()) / 86_400_000
    const endDiff = Math.abs(new Date(v.end).getTime() - priorTarget.getTime()) / 86_400_000
    const durDiff = Math.abs(vDur - dur)
    if (endDiff > 45 || durDiff > 25) continue
    const score = endDiff * 2 + durDiff
    if (score < bestScore) { bestScore = score; best = v }
  }

  if (!best) return null  // cannot reliably compute LTM without prior-year YTD

  return lastAnn.val + curr.val - best.val
}

// ── Main fetcher ──────────────────────────────────────────────────────────────

export async function fetchXbrlFundamentals(cik: string): Promise<XbrlFundamentals | null> {
  try {
    const paddedCik = cik.padStart(10, "0")
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`,
      {
        headers: { "User-Agent": EDGAR_UA },
        next: { revalidate: 3_600 }, // 1h cache
      } as RequestInit,
    )
    if (!res.ok) return null

    const data: XbrlCompanyFacts = await res.json()
    const gaap = data.facts?.["us-gaap"]
    if (!gaap) return null

    const M = 1_000_000

    // ── Income statement / cash flow (annual IS = duration-based) ────────────

    const revenueArr = firstConcept(gaap, [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
      "RevenuesNetOfInterestExpense",
    ])
    const ebitArr = firstConcept(gaap, ["OperatingIncomeLoss"])
    const netIncArr = firstConcept(gaap, [
      "NetIncomeLoss",
      "NetIncomeLossAvailableToCommonStockholdersBasic",
      "ProfitLoss",
    ])
    const intExpArr = firstConcept(gaap, [
      "InterestExpense",
      "InterestAndDebtExpense",
      "InterestExpenseDebt",
    ])
    const taxArr = firstConcept(gaap, ["IncomeTaxExpenseBenefit"])
    const daArr = firstConcept(gaap, [
      "DepreciationDepletionAndAmortization",
      "DepreciationAndAmortization",
      "Depreciation",
      "DepreciationAmortizationAndAccretionNet",
      "OtherDepreciationAndAmortization",
      "DepreciationNonproduction",
    ])
    const epsDilArr = firstConcept(gaap, [
      "EarningsPerShareDiluted",
      "EarningsPerShareBasicAndDiluted",
    ], "USD/shares")
    const dpsArr = firstConcept(gaap, [
      "CommonStockDividendsPerShareDeclared",
      "CommonStockDividendsPerShareCashPaid",
    ], "USD/shares")
    const grossProfitArr = firstConcept(gaap, ["GrossProfit"])
    const ocfArr = firstConcept(gaap, [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByOperatingActivities",
    ])
    const capexArr = firstConcept(gaap, [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
    ])
    const debtIssuedArr = firstConcept(gaap, [
      "ProceedsFromIssuanceOfLongTermDebt",
      "ProceedsFromIssuanceOfDebt",
    ])
    const debtRepaidArr = firstConcept(gaap, [
      "RepaymentsOfLongTermDebt",
      "RepaymentsOfDebt",
    ])
    const sharesDilAnnualArr = firstConcept(gaap, [
      "WeightedAverageNumberOfDilutedSharesOutstanding",
      "CommonStockSharesOutstanding",
    ], "shares")
    const sharesBasicAnnualArr = firstConcept(gaap, [
      "WeightedAverageNumberOfSharesOutstandingBasic",
    ], "shares")

    // Align all IS arrays to the revenue year-end dates (the "master" timeline)
    // Revenue is most reliably populated; use it as the reference timeline.
    const masterDates = revenueArr.map((v) => v.end)
    if (masterDates.length === 0) return null

    function alignToMaster(arr: XbrlUnit[], tolerance = 35): number[] {
      return masterDates.map((d) => {
        const target = new Date(d).getTime()
        let closest: XbrlUnit | null = null
        let minDiff = Infinity
        for (const v of arr) {
          const diff = Math.abs(new Date(v.end).getTime() - target)
          if (diff < minDiff && diff <= tolerance * 86_400_000) {
            minDiff = diff
            closest = v
          }
        }
        return closest ? closest.val : 0
      })
    }

    const revVals     = revenueArr.map((v) => v.val)
    const ebitVals    = alignToMaster(ebitArr)
    const niVals      = alignToMaster(netIncArr)
    const intVals     = alignToMaster(intExpArr)
    const taxVals     = alignToMaster(taxArr)
    const daVals      = alignToMaster(daArr)
    const epsDilVals  = alignToMaster(epsDilArr)
    const dpsVals     = alignToMaster(dpsArr)
    const gpVals      = alignToMaster(grossProfitArr)
    const ocfVals     = alignToMaster(ocfArr)
    const capexVals   = alignToMaster(capexArr).map(Math.abs)
    const issuedVals  = alignToMaster(debtIssuedArr)
    const repaidVals  = alignToMaster(debtRepaidArr).map(Math.abs)
    const netBorrowVals = issuedVals.map((v, i) => v - repaidVals[i])
    const sdDilVals   = alignToMaster(sharesDilAnnualArr)
    const sbVals      = alignToMaster(sharesBasicAnnualArr)

    // ── Balance sheet (instant facts aligned to IS fiscal year ends) ──────────

    const totalAssetsVals  = firstConceptInstant(gaap, ["Assets"], masterDates)
    const totalDebtVals    = firstConceptInstant(gaap, [
      "LongTermDebtAndCapitalLeaseObligations",
      "LongTermDebt",
    ], masterDates)
    const cashVals         = firstConceptInstant(gaap, [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsAndShortTermInvestments",
    ], masterDates)
    const equityVals       = firstConceptInstant(gaap, [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ], masterDates)
    const goodwillVals     = firstConceptInstant(gaap, ["Goodwill"], masterDates)
    const intangiblesVals  = firstConceptInstant(gaap, [
      "FiniteLivedIntangibleAssetsNet",
      "IntangibleAssetsNetExcludingGoodwill",
    ], masterDates)
    const sharesInstVals   = firstConceptInstant(gaap, [
      "CommonStockSharesOutstanding",
    ], masterDates, "shares")

    // Compute BVPS per year (equity / shares)
    const bvpsVals = equityVals.map((eq, i) => {
      const sh = sdDilVals[i] || sharesInstVals[i] || 1
      return sh > 0 ? (eq / sh) : 0
    })

    // ── Take latest N years (up to 5) ────────────────────────────────────────

    const N = Math.min(masterDates.length, 5)
    const slice = <T>(arr: T[]) => arr.slice(-N)

    const years = slice(masterDates).map((d) => new Date(d).getFullYear())

    // Current period = last in array
    const last = <T>(arr: T[]) => arr[arr.length - 1] ?? 0

    const revenue_curr      = last(revVals)     / M
    const ebit_curr         = last(ebitVals)    / M
    const ni_curr           = last(niVals)      / M
    const int_curr          = last(intVals)     / M
    const tax_curr          = last(taxVals)     / M
    const da_curr           = last(daVals)      / M
    const eps_curr          = last(epsDilVals)  // already per-share
    const dps_curr          = last(dpsVals)     // already per-share
    const gp_curr           = last(gpVals)      / M
    const totalAssets_curr  = last(totalAssetsVals)  / M
    const totalDebt_curr    = last(totalDebtVals)    / M
    const cash_curr         = last(cashVals)         / M
    const equity_curr       = last(equityVals)       / M
    const goodwill_curr     = last(goodwillVals)     / M
    const intangibles_curr  = last(intangiblesVals)  / M
    const sharesDil_curr    = last(sdDilVals)        / M  // convert to millions
    const sharesBasic_curr  = last(sbVals)           / M
    const bvps_curr         = last(bvpsVals)         // per-share (USD)
    const ocf_curr          = last(ocfVals)          / M
    const capex_curr        = last(capexVals)        / M
    const netBorrow_curr    = last(netBorrowVals)    / M

    const ebitda_curr = ebit_curr + da_curr
    const net_debt_curr = totalDebt_curr - cash_curr

    // Tax rate (clamp 0–50%)
    const pretaxApprox = ebit_curr - int_curr
    const tax_rate_curr = pretaxApprox > 0 ? Math.min(0.5, Math.max(0, tax_curr / pretaxApprox)) : 0.21

    const payout_curr = eps_curr > 0 && dps_curr > 0 ? Math.min(1, dps_curr / eps_curr) : 0

    // ── LTM computation ───────────────────────────────────────────────────────
    // Fetch all (unfiltered) XBRL entries for flow concepts to enable quarterly LTM math
    const lastAnnualEnd = masterDates[masterDates.length - 1] ?? ""

    const rawRevArr   = allConceptValues(gaap, [
      "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
      "SalesRevenueNet", "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense",
    ])
    const rawEbitArr  = allConceptValues(gaap, ["OperatingIncomeLoss"])
    const rawNiArr    = allConceptValues(gaap, [
      "NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss",
    ])
    const rawDaArr    = allConceptValues(gaap, [
      "DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
      "Depreciation", "DepreciationAmortizationAndAccretionNet",
      "OtherDepreciationAndAmortization", "DepreciationNonproduction",
    ])
    const rawGpArr    = allConceptValues(gaap, ["GrossProfit"])
    const rawOcfArr   = allConceptValues(gaap, [
      "NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByOperatingActivities",
    ])
    const rawCapexArr = allConceptValues(gaap, [
      "PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
    ])

    // Check if any 10-Q data exists beyond the last annual filing
    const qtdYtdCheck = latestQtdYtd(rawRevArr)
    const hasRecentQtd = !!qtdYtdCheck && qtdYtdCheck.entry.end > lastAnnualEnd

    let ltm: LtmData | undefined
    if (hasRecentQtd) {
      const ltmRev  = ltmVal(revenueArr, rawRevArr,   lastAnnualEnd)
      const ltmEbit = ltmVal(ebitArr,    rawEbitArr,   lastAnnualEnd)
      const ltmNi   = ltmVal(netIncArr,  rawNiArr,     lastAnnualEnd)
      const ltmDa   = ltmVal(daArr,      rawDaArr,     lastAnnualEnd)
      const ltmGp   = ltmVal(grossProfitArr, rawGpArr, lastAnnualEnd)
      const ltmOcf  = ltmVal(ocfArr,     rawOcfArr,    lastAnnualEnd)
      const ltmCpx  = ltmVal(capexArr,   rawCapexArr,  lastAnnualEnd)

      // Only publish LTM block if the two most critical fields computed successfully
      if (ltmRev !== null && ltmEbit !== null) {
        const ltmRevM  = ltmRev  / M
        const ltmEbitM = ltmEbit / M
        const ltmDaM   = (ltmDa  ?? 0) / M
        const ltmNiM   = (ltmNi  ?? 0) / M
        const ltmGpM   = (ltmGp  ?? 0) / M
        const ltmOcfM  = (ltmOcf ?? 0) / M
        const ltmCpxM  = ltmCpx !== null ? Math.abs(ltmCpx) / M : 0

        const { entry: qtd, dur } = qtdYtdCheck!
        const quartersAhead = dur <= 120 ? 1 : dur <= 200 ? 2 : 3

        ltm = {
          revenue:     ltmRevM,
          ebit:        ltmEbitM,
          net_income:  ltmNiM,
          da_total:    ltmDaM,
          gross_profit: ltmGpM,
          ocf:         ltmOcfM,
          capex:       ltmCpxM,
          ebitda:      ltmEbitM + ltmDaM,
          endDate:     qtd.end,
          quartersAhead,
        }
      }
    }

    // Determine filedDate and fiscalYearEnd from last entry
    const lastEntry = revenueArr[revenueArr.length - 1]

    return {
      revenue:          revenue_curr,
      ebit:             ebit_curr,
      net_income:       ni_curr,
      interest_expense: int_curr,
      tax_expense:      tax_curr,
      da_total:         da_curr,
      eps_diluted:      eps_curr,
      dps:              dps_curr,
      gross_profit:     gp_curr,
      total_assets:     totalAssets_curr,
      total_debt:       totalDebt_curr,
      cash:             cash_curr,
      total_equity:     equity_curr,
      goodwill:         goodwill_curr,
      intangibles:      intangibles_curr,
      shares_diluted:   sharesDil_curr,
      shares_basic:     sharesBasic_curr,
      bvps:             bvps_curr,
      ocf:              ocf_curr,
      capex:            capex_curr,
      net_borrowing:    netBorrow_curr,
      ebitda:           ebitda_curr,
      net_debt:         net_debt_curr,
      tax_rate:         tax_rate_curr,
      payout_ratio:     payout_curr,
      ltm,

      hist: {
        year:        years,
        revenue:     slice(revVals).map((v) => v / M),
        ebit:        slice(ebitVals).map((v) => v / M),
        net_income:  slice(niVals).map((v) => v / M),
        eps_diluted: slice(epsDilVals),
        dps:         slice(dpsVals),
        ocf:         slice(ocfVals).map((v) => v / M),
        capex:       slice(capexVals).map((v) => v / M),
        bvps:        slice(bvpsVals),
        da:          slice(daVals).map((v) => v / M),
      },

      cik: String(data.cik).padStart(10, "0"),
      filedDate:     lastEntry?.filed ?? "",
      fiscalYearEnd: lastEntry?.end   ?? "",
    }
  } catch (err) {
    console.error("[edgarXbrl] fetchXbrlFundamentals error:", err)
    return null
  }
}
