/**
 * Server-only module. Do NOT import in client components.
 * Fetches live data from Yahoo Finance (market data) + SEC EDGAR XBRL (fundamentals)
 * and maps it to the ValuationConfig shape used throughout the app.
 *
 * Priority: XBRL primary for all fundamental data; Yahoo Finance for market data only.
 */

import YahooFinance from "yahoo-finance2"
import type { ValuationConfig, Baseline, HistoricalIS, NewsArticle, DataFlags } from "@/types/valuation"
import { fetchXbrlFundamentals } from "./edgarXbrl"
import { fetchNews } from "./newsFetcher"
import { fetchPeerComps } from "./peerFetcher"
import { fetchLiveRiskFreeRate } from "./fredFetcher"
import { fetchConsensusEstimates } from "./fmpFetcher"

const yahooFinance = new YahooFinance()

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely coerce any value to a finite number. */
function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return isFinite(x) ? x : fallback
}

const M = 1_000_000  // Yahoo returns raw USD; divide by this → millions

// ── SEC EDGAR ─────────────────────────────────────────────────────────────────

const EDGAR_UA = "MSF-AI-Finance contact@msf.ai"

export interface SecFiling {
  date: string
  url: string
  accessionNumber: string
  companyName: string
}

async function lookupCIK(ticker: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": EDGAR_UA },
      next: { revalidate: 86_400 },   // cache 24 h
    } as RequestInit)
    const data: Record<string, { cik_str: number; ticker: string; title: string }> =
      await res.json()
    const entry = Object.values(data).find(
      (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
    )
    return entry ? String(entry.cik_str).padStart(10, "0") : null
  } catch {
    return null
  }
}

async function fetchLatest10K(cik: string): Promise<SecFiling | null> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": EDGAR_UA },
      next: { revalidate: 3_600 },    // cache 1 h
    } as RequestInit)
    const data = await res.json()
    const recent = data.filings?.recent
    if (!recent) return null

    const forms: string[]      = recent.form ?? []
    const dates: string[]      = recent.filingDate ?? []
    const accessions: string[] = recent.accessionNumber ?? []
    const docs: string[]       = recent.primaryDocument ?? []

    const idx = forms.findIndex((f: string) => f === "10-K")
    if (idx === -1) return null

    const cikNum = cik.replace(/^0+/, "")
    const acc    = accessions[idx].replace(/-/g, "")

    return {
      date:            dates[idx],
      url:             `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${docs[idx]}`,
      accessionNumber: accessions[idx],
      companyName:     String(data.name ?? ""),
    }
  } catch {
    return null
  }
}

// ── Main fetcher ──────────────────────────────────────────────────────────────

export interface FetchResult {
  config: ValuationConfig
  sec: SecFiling | null
  news: NewsArticle[]
  cachedAt: string
}

export async function fetchLiveConfig(ticker: string): Promise<FetchResult> {
  const T = ticker.toUpperCase()

  // ── Parallel fetch: Yahoo (market data only) + SEC CIK lookup ─────────────
  const [quote, cik] = await Promise.all([
    yahooFinance.quoteSummary(T, {
      modules: [
        "price",
        "defaultKeyStatistics",
        "summaryDetail",
        "assetProfile",
        // Removed: financialData, incomeStatementHistory, cashflowStatementHistory, balanceSheetHistory
        // These were deprecated by Yahoo Finance in Nov 2024; XBRL is now the primary source
      ],
    }),
    lookupCIK(T),
  ])

  // ── Parallel fetch: 10-K metadata + XBRL fundamentals + news + peer comps + FRED rf ──
  const companyName = String((quote.price as { longName?: string; shortName?: string })?.longName ?? "")
  const sector = String((quote.assetProfile as { sector?: string })?.sector ?? "")
  type PriceFull = { regularMarketPrice?: number; marketCap?: number }
  const prFull = (quote.price ?? {}) as PriceFull
  const approxMktCapM = prFull.marketCap ? prFull.marketCap / 1_000_000 : 0

  const [sec, xbrl, news, liveComps, fredResult] = await Promise.all([
    cik ? fetchLatest10K(cik) : Promise.resolve(null),
    cik ? fetchXbrlFundamentals(cik) : Promise.resolve(null),
    fetchNews(T, companyName),
    fetchPeerComps(T, sector, undefined, approxMktCapM),
    fetchLiveRiskFreeRate(),
  ])

  // ── FMP consensus (needs XBRL revenue as baseline — run after xbrl resolves) ──
  const baselineRevForConsensus = xbrl?.ltm?.revenue ?? xbrl?.revenue ?? 0
  const consensus = await fetchConsensusEstimates(T, baselineRevForConsensus)

  // ── Yahoo market data (always live) ──────────────────────────────────────
  // Type assertions needed because reduced module set narrows types
  type PriceModule = { regularMarketPrice?: number; longName?: string; shortName?: string; exchangeName?: string; currency?: string }
  type KsModule    = { trailingEps?: number; beta?: number; bookValue?: number; sharesOutstanding?: number; earningsQuarterlyGrowth?: number }
  type SdModule    = { dividendRate?: number; lastDividendValue?: number; payoutRatio?: number; beta?: number }
  type ApModule    = { industry?: string }

  const price = (quote.price               ?? {}) as PriceModule
  const ks    = (quote.defaultKeyStatistics ?? {}) as KsModule
  const sd    = (quote.summaryDetail       ?? {}) as SdModule
  const ap    = (quote.assetProfile        ?? {}) as ApModule

  const currentPrice = n(price.regularMarketPrice)
  const beta         = n(ks.beta ?? sd.beta, 1.0)

  // ── Fundamentals: XBRL primary, Yahoo fallback ────────────────────────────
  // When a recent 10-Q exists, use LTM figures instead of the last annual 10-K.
  // LTM = Last Annual + Current YTD - Prior Year YTD (industry-standard calculation).
  const ltm = xbrl?.ltm
  const usingLtm = !!ltm

  // Revenue / income
  const revenue    = ltm?.revenue    ?? xbrl?.revenue    ?? 0
  const netIncome  = ltm?.net_income ?? xbrl?.net_income ?? 0
  const eps        = xbrl?.eps_diluted ?? n(ks.trailingEps)  // EPS from annual (diluted shares vary)
  const dps        = xbrl?.dps        ?? n(sd.dividendRate ?? sd.lastDividendValue)

  // Margins — compute from XBRL data
  const grossProfit  = ltm?.gross_profit ?? xbrl?.gross_profit ?? 0
  const grossMargin  = revenue > 0 ? grossProfit / revenue : 0
  const cogs         = revenue - grossProfit
  const operatingInc = ltm?.ebit     ?? xbrl?.ebit     ?? 0
  const opMargin     = revenue > 0 ? operatingInc / revenue : 0
  const sga          = Math.max(0, grossProfit - operatingInc)

  // D&A: prefer LTM, then XBRL annual; fall back to 3% of revenue if absent
  const daRaw = ltm?.da_total ?? xbrl?.da_total ?? 0
  const da_is_fallback = daRaw <= 0
  const da = da_is_fallback ? revenue * 0.03 : daRaw

  // EBITDA recomputed from EBIT + D&A so the fallback da is reflected
  const ebitda       = operatingInc + da
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0

  // Balance sheet
  const totalDebt   = xbrl?.total_debt   ?? 0
  const cash        = xbrl?.cash         ?? 0
  const netDebt     = totalDebt - cash
  const bvps        = xbrl?.bvps         ?? n(ks.bookValue)
  const totalEq     = xbrl?.total_equity ?? (bvps * (xbrl?.shares_diluted ?? n(ks.sharesOutstanding) / M))
  const totalAssets = xbrl?.total_assets ?? 0
  const goodwill    = xbrl?.goodwill     ?? 0
  const sharesDil   = xbrl?.shares_diluted ?? n(ks.sharesOutstanding) / M
  const sharesBasic = xbrl?.shares_basic   ?? sharesDil

  // Cash flow — LTM preferred when available
  const ocf         = ltm?.ocf  ?? xbrl?.ocf  ?? 0
  const capexLtmRaw = ltm?.capex
  const capexXbrl   = xbrl?.capex
  const capexRaw    = capexLtmRaw ?? capexXbrl
  const capex_is_fallback = (capexRaw == null || capexRaw <= 0) && !usingLtm
  const capex       = (capexRaw != null && capexRaw > 0) ? capexRaw : revenue * 0.025
  const netBorrow   = xbrl?.net_borrowing ?? 0
  const fcf         = ocf - capex

  // Tax / interest
  const taxRate      = xbrl?.tax_rate    ?? 0.21
  const interestExp  = xbrl?.interest_expense ?? 0
  const pretaxInc    = taxRate < 1 && taxRate > 0 ? netIncome / (1 - taxRate) : netIncome
  const tax          = pretaxInc * taxRate

  // Derived
  const roe         = totalEq > 0 ? netIncome / totalEq : 0
  const payoutRatio = xbrl?.payout_ratio ?? (eps > 0 && dps > 0 ? Math.min(1, dps / eps) : n(sd.payoutRatio))
  const plowback    = 1 - payoutRatio

  // ── Historical income statement ────────────────────────────────────────────
  // XBRL hist arrays come oldest→newest and are already in millions
  const hist = xbrl?.hist

  const histYear:      number[] = hist?.year        ?? []
  const histRevenue:   number[] = hist?.revenue     ?? []
  // Historical EBITDA = per-year EBIT + per-year D&A (fall back to 3% of revenue when D&A absent)
  const histDa:        number[] = hist?.da           ?? []
  const histEbitda:    number[] = hist?.ebit
    ? hist.ebit.map((e, i) => {
        const yearDa = (histDa[i] ?? 0) > 0 ? histDa[i] : (histRevenue[i] ?? 0) * 0.03
        return e + yearDa
      })
    : []
  const histNetIncome: number[] = hist?.net_income  ?? []
  const histEps:       number[] = hist?.eps_diluted ?? []
  const histDps:       number[] = hist?.dps         ?? []
  const histOcf:       number[] = hist?.ocf         ?? []
  const histCapex:     number[] = hist?.capex       ?? []
  const histBvps:      number[] = hist?.bvps        ?? []

  // ── Assemble Baseline ─────────────────────────────────────────────────────
  const baseline: Baseline = {
    revenue, ebitda, adj_ebitda: ebitda,
    adj_ebitda_margin: ebitdaMargin, ebitda_margin: ebitdaMargin,
    net_income: netIncome, adj_net_income: netIncome,
    fcf, adj_eps: eps, eps, dps,
    current_price: currentPrice, shares_diluted: sharesDil,
    net_debt: netDebt, bvps, roe,
    total_debt: totalDebt, total_equity: totalEq,
    total_assets: totalAssets, goodwill, tax_rate: taxRate,
    payout_ratio: payoutRatio, plowback_ratio: plowback,
    gross_margin: grossMargin, cogs, gross_profit: grossProfit,
    sga, da_total: da, operating_income: operatingInc,
    interest_expense: interestExp, pretax_income: pretaxInc, tax,
    // New fields
    ocf, ebit: operatingInc, shares_basic: sharesBasic,
    capex, net_borrowing: netBorrow,
  }

  // ── Assemble HistoricalIS ─────────────────────────────────────────────────
  const historical_is: HistoricalIS = {
    year:       histYear,
    revenue:    histRevenue,
    ebitda:     histEbitda,
    net_income: histNetIncome,
    eps:        histEps,
    dps:        histDps,
    ocf:        histOcf,
    capex:      histCapex,
    bvps:       histBvps,
  }

  // ── Assemble ValuationConfig ──────────────────────────────────────────────
  const config: ValuationConfig = {
    ticker: T,
    name:        String(price.longName ?? price.shortName ?? T),
    exchange:    String(price.exchangeName ?? "US"),
    fiscal_year: usingLtm && ltm
      ? (() => {
          const d = new Date(ltm.endDate)
          const qName = ["", "Q1", "Q2", "Q3"][ltm.quartersAhead] ?? `Q${ltm.quartersAhead}`
          return `LTM ${qName} FY${d.getFullYear()}`
        })()
      : xbrl?.fiscalYearEnd
        ? `FY${new Date(xbrl.fiscalYearEnd).getFullYear()}`
        : `FY${new Date().getFullYear() - 1}`,
    currency:    String(price.currency ?? "USD"),
    units:       "millions",
    sources:     sec
      ? `SEC EDGAR XBRL (${xbrl?.filedDate ?? sec.date}) · Yahoo Finance (market data)`
      : "Yahoo Finance live (no SEC XBRL data)",
    disclaimer: sec
      ? `Latest 10-K: ${sec.url}`
      : "Live data from Yahoo Finance. For informational purposes only.",
    baseline,
    historical_is,
    segments: {
      [String(ap.industry ?? "Core Business")]: {
        revenue,
        adj_op_margin: opMargin,
      },
    },
    acquisitions: {},
    comps: liveComps,
    capm: {
      rf:           fredResult.rf,   // live 10-yr Treasury from FRED (or 4.3% fallback)
      beta,
      erp:          0.055,           // Damodaran implied ERP — updated manually each quarter
      cost_of_debt: 0.045,
    },
    default_assumptions: (() => {
      // ── Company-specific growth rates from historical data ──────────────────
      // Use 3-year average historical revenue growth as the Base starting point.
      // FMP consensus overrides this when available (more accurate).
      // This replaces the generic 2.5/3.5/4.0% presets which systematically
      // undervalue fast-growing companies and bias signals toward SELL.
      const histGrowthRates: number[] = []
      for (let i = 1; i < histRevenue.length; i++) {
        if (histRevenue[i - 1] > 0 && histRevenue[i] > 0) {
          histGrowthRates.push(histRevenue[i] / histRevenue[i - 1] - 1)
        }
      }
      const recentGrowth = histGrowthRates.slice(-3)
      const avgHistGrowth = recentGrowth.length > 0
        ? recentGrowth.reduce((a, b) => a + b, 0) / recentGrowth.length
        : 0.04
      // Clamp to 0–60% (avoid NVDA-style 100%+ distorting the base case)
      const yr1_hist = Math.min(0.60, Math.max(0.01, avgHistGrowth))
      // Gentle taper: base case assumes growth moderates over the projection period
      const yr2_hist = yr1_hist * 0.85
      const yr3_hist = yr2_hist * 0.80

      // ── Exit multiple from peer median EV/EBITDA ────────────────────────────
      // Derive from actual peer comps so each company gets a sector-appropriate multiple.
      // Require ≥3 peers for median; fall back to sector default if peer set is thin.
      const peerEvEbitdas = Object.values(liveComps)
        .map((c) => c.ev_ebitda)
        .filter((v) => v > 3 && v < 80)  // cap at 80x — outliers (NVDA AI hype) skew average
      const sortedPeers = [...peerEvEbitdas].sort((a, b) => a - b)
      // Use lower-middle for even arrays (conservative: avoid outlier inflation)
      const midIdx = Math.floor((sortedPeers.length - 1) / 2)
      const peerMedianEvEbitda = sortedPeers.length >= 3
        ? sortedPeers[midIdx]
        : sortedPeers.length > 0
          ? sortedPeers.reduce((a, b) => a + b, 0) / sortedPeers.length  // mean if <3 peers
          : 18.0  // S&P 500 long-run median

      // ── Forward-looking growth bias correction ──────────────────────────────
      // Historical 3yr avg can be stale for cyclical dips (e.g. AAPL FY2023 was -2.9%).
      // Apply a mild upward correction toward the most recent year's actual growth,
      // blending 60% most-recent-year + 40% 3yr-average — more predictive than pure average.
      const mostRecentGrowth = histGrowthRates.length > 0
        ? histGrowthRates[histGrowthRates.length - 1]
        : avgHistGrowth
      const blendedGrowth = 0.6 * mostRecentGrowth + 0.4 * avgHistGrowth
      const yr1_base = Math.min(0.60, Math.max(0.01, blendedGrowth))
      const yr2_base = yr1_base * 0.85
      const yr3_base = yr2_base * 0.80

      return {
        beta,
        capex_pct: revenue > 0 ? capex / revenue : 0.03,
        tax_rate: taxRate,
        // Growth: FMP consensus > blended historical > generic preset (in priority order)
        yr1_g: consensus?.yr1_g ?? yr1_base,
        yr2_g: consensus?.yr2_g ?? yr2_base,
        yr3_g: consensus?.yr3_g ?? yr3_base,
        // Exit multiple: peer median EV/EBITDA (≥3 peers) or mean, never <6x
        exit_mult: Math.max(6, peerMedianEvEbitda),
      }
    })(),
    overview_metrics: {
      revenue_growth: histRevenue.length >= 2 && histRevenue[histRevenue.length - 2] > 0
        ? `${(((histRevenue[histRevenue.length - 1] / histRevenue[histRevenue.length - 2]) - 1) * 100).toFixed(1)}%`
        : undefined,
      adj_eps_growth: histEps.length >= 2 && histEps[histEps.length - 2] > 0
        ? `${(((histEps[histEps.length - 1] / histEps[histEps.length - 2]) - 1) * 100).toFixed(1)}%`
        : undefined,
    },
    dataFlags: {
      da_is_fallback,
      capex_is_fallback,
      ocf_missing: (xbrl?.ocf ?? 0) <= 0 && !usingLtm,
      rf_source:   fredResult.rfSource,
      rf_date:     fredResult.rfDate,
      data_age_days: sec?.date
        ? Math.floor((Date.now() - new Date(sec.date).getTime()) / 86_400_000)
        : -1,
      hist_years:  histRevenue.length,
      filing_date: sec?.date ?? "",
      ltm_available:       usingLtm,
      ltm_end_date:        ltm?.endDate ?? "",
      ltm_quarters_ahead:  ltm?.quartersAhead ?? 0,
      consensus_available: consensus !== null,
      consensus_analysts:  consensus?.analysts ?? 0,
    } satisfies DataFlags,
    ...(consensus && { consensus }),
  }

  return { config, sec, news, cachedAt: new Date().toISOString() }
}
