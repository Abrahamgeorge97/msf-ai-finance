/**
 * Server-only module. Do NOT import in client components.
 * Fetches live data from Yahoo Finance (market data) + SEC EDGAR XBRL (fundamentals)
 * and maps it to the ValuationConfig shape used throughout the app.
 *
 * Priority: XBRL primary for all fundamental data; Yahoo Finance for market data only.
 */

import YahooFinance from "yahoo-finance2"
import type { ValuationConfig, Baseline, HistoricalIS, NewsArticle } from "@/types/valuation"
import { fetchXbrlFundamentals } from "./edgarXbrl"
import { fetchNews } from "./newsFetcher"

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

  // ── Parallel fetch: 10-K metadata + XBRL fundamentals + news ────────────
  const companyName = String((quote.price as { longName?: string; shortName?: string })?.longName ?? "")
  const [sec, xbrl, news] = await Promise.all([
    cik ? fetchLatest10K(cik) : Promise.resolve(null),
    cik ? fetchXbrlFundamentals(cik) : Promise.resolve(null),
    fetchNews(T, companyName),
  ])

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

  // Revenue / income
  const revenue    = xbrl?.revenue    ?? 0
  const ebitda     = xbrl?.ebitda     ?? 0
  const netIncome  = xbrl?.net_income ?? 0
  const eps        = xbrl?.eps_diluted ?? n(ks.trailingEps)
  const dps        = xbrl?.dps        ?? n(sd.dividendRate ?? sd.lastDividendValue)

  // Margins — compute from XBRL data
  const grossProfit  = xbrl?.gross_profit ?? 0
  const grossMargin  = revenue > 0 ? grossProfit / revenue : 0
  const cogs         = revenue - grossProfit
  const operatingInc = xbrl?.ebit     ?? 0
  const opMargin     = revenue > 0 ? operatingInc / revenue : 0
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0
  const sga          = Math.max(0, grossProfit - operatingInc)
  const da           = xbrl?.da_total ?? 0

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

  // Cash flow
  const ocf         = xbrl?.ocf         ?? 0
  const capex       = xbrl?.capex       ?? (revenue * 0.025)  // 2.5% fallback only if no XBRL data
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
  // Approximate EBITDA per period as EBIT + current-period D&A (close enough for chart display)
  const histEbitda:    number[] = hist?.ebit
    ? hist.ebit.map((e) => e + (xbrl?.da_total ?? 0))
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
    fiscal_year: xbrl?.fiscalYearEnd
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
    comps: {
      "Peer A": { ev_ebitda: 12.0, ev_rev: 2.8, pe: 22.0, peg: 1.5, pb: 4.2, pcf: 14.0 },
      "Peer B": { ev_ebitda: 14.5, ev_rev: 3.2, pe: 26.0, peg: 1.8, pb: 5.1, pcf: 17.0 },
      "Peer C": { ev_ebitda: 11.0, ev_rev: 2.4, pe: 19.0, peg: 1.3, pb: 3.8, pcf: 12.0 },
      "Peer D": { ev_ebitda: 13.5, ev_rev: 3.0, pe: 24.0, peg: 1.6, pb: 4.6, pcf: 15.5 },
    },
    capm: {
      rf:           0.043,
      beta,
      erp:          0.055,
      cost_of_debt: 0.045,
    },
    default_assumptions: {
      beta,
      capex_pct: revenue > 0 ? capex / revenue : 0.03,
      tax_rate: taxRate,
    },
    overview_metrics: {
      revenue_growth: histRevenue.length >= 2 && histRevenue[histRevenue.length - 2] > 0
        ? `${(((histRevenue[histRevenue.length - 1] / histRevenue[histRevenue.length - 2]) - 1) * 100).toFixed(1)}%`
        : undefined,
      adj_eps_growth: histEps.length >= 2 && histEps[histEps.length - 2] > 0
        ? `${(((histEps[histEps.length - 1] / histEps[histEps.length - 2]) - 1) * 100).toFixed(1)}%`
        : undefined,
    },
  }

  return { config, sec, news, cachedAt: new Date().toISOString() }
}
