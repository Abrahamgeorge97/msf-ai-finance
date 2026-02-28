/**
 * Server-only module. Do NOT import in client components.
 * Fetches live sector peer comparable multiples from Yahoo Finance.
 * Peers are selected by GICS sector (from assetProfile.sector).
 */

import YahooFinance from "yahoo-finance2"
import type { Comp } from "@/types/valuation"

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return isFinite(x) && x > 0 ? x : fallback
}

// ── Sector → Peer Tickers ──────────────────────────────────────────────────────
// Curated large-cap peers by GICS sector (Yahoo Finance assetProfile.sector)
const SECTOR_PEERS: Record<string, string[]> = {
  "Technology":             ["AAPL", "MSFT", "NVDA", "ORCL", "ADBE", "CRM", "AMD", "INTC", "QCOM", "TXN"],
  "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "WBD", "PARA"],
  "Financial Services":     ["JPM", "BAC", "WFC", "GS", "MS", "BLK", "C", "AXP", "V", "MA"],
  "Healthcare":             ["JNJ", "PFE", "MRK", "ABBV", "LLY", "UNH", "BMY", "AMGN", "GILD", "TMO"],
  "Consumer Cyclical":      ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "TGT", "BKNG", "GM"],
  "Consumer Defensive":     ["PG", "KO", "PEP", "WMT", "COST", "MDLZ", "CL", "GIS", "EL", "KHC"],
  "Energy":                 ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "VLO", "PSX", "OXY", "HAL"],
  "Industrials":            ["BA", "CAT", "GE", "HON", "UPS", "RTX", "LMT", "DE", "MMM", "EMR"],
  "Basic Materials":        ["LIN", "APD", "FCX", "NEM", "DOW", "DD", "ALB", "CF", "NUE", "VMC"],
  "Real Estate":            ["AMT", "PLD", "CCI", "EQIX", "PSA", "O", "WELL", "AVB", "EQR", "SPG"],
  "Utilities":              ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "ED", "XEL", "PCG"],
}

const FALLBACK_PEERS = ["AAPL", "MSFT", "GOOGL", "META", "AMZN"]

const HARDCODED_FALLBACK: Record<string, Comp> = {
  "Peer A": { ev_ebitda: 12.0, ev_rev: 2.8, pe: 22.0, peg: 1.5, pb: 4.2, pcf: 14.0 },
  "Peer B": { ev_ebitda: 14.5, ev_rev: 3.2, pe: 26.0, peg: 1.8, pb: 5.1, pcf: 17.0 },
  "Peer C": { ev_ebitda: 11.0, ev_rev: 2.4, pe: 19.0, peg: 1.3, pb: 3.8, pcf: 12.0 },
  "Peer D": { ev_ebitda: 13.5, ev_rev: 3.0, pe: 24.0, peg: 1.6, pb: 4.6, pcf: 15.5 },
}

// ── Type shims for reduced module set ─────────────────────────────────────────
type KsMod = {
  enterpriseToEbitda?: number
  enterpriseToRevenue?: number
  pegRatio?: number
  priceToBook?: number
  forwardPE?: number
  sharesOutstanding?: number
}
type SdMod = { trailingPE?: number; forwardPE?: number }
type FdMod = { operatingCashflow?: number }
type PrMod = { regularMarketPrice?: number }

// ── Fetch one peer's multiples ─────────────────────────────────────────────────
async function fetchOneComp(peerTicker: string): Promise<Comp | null> {
  try {
    const data = await yahooFinance.quoteSummary(peerTicker, {
      modules: ["defaultKeyStatistics", "summaryDetail", "financialData", "price"],
    })

    const ks = (data.defaultKeyStatistics ?? {}) as KsMod
    const sd = (data.summaryDetail       ?? {}) as SdMod
    const fd = (data.financialData       ?? {}) as FdMod
    const pr = (data.price               ?? {}) as PrMod

    const price  = n(pr.regularMarketPrice)
    const shares = n(ks.sharesOutstanding)
    const ocf    = n(fd.operatingCashflow)
    const cfps   = shares > 0 ? ocf / shares : 0

    const pe = n(sd.trailingPE) || n(sd.forwardPE) || n(ks.forwardPE, 20)

    const comp: Comp = {
      ev_ebitda: n(ks.enterpriseToEbitda, 15),
      ev_rev:    n(ks.enterpriseToRevenue, 3),
      pe,
      peg:       n(ks.pegRatio, 1.5),
      pb:        n(ks.priceToBook, 4),
      pcf:       cfps > 0 && price > 0 ? price / cfps : 15,
    }

    // Reject if core multiples are implausible
    if (comp.ev_ebitda <= 0 || comp.pe <= 0) return null

    return comp
  } catch {
    return null
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Fetches live comparable multiples for 4 sector peers of the given ticker.
 * Falls back to hardcoded Peer A–D if fewer than 2 live fetches succeed.
 *
 * @param ticker  - The ticker being analyzed (excluded from peer list)
 * @param sector  - Yahoo Finance assetProfile.sector (e.g. "Technology")
 */
export async function fetchPeerComps(
  ticker: string,
  sector: string,
): Promise<Record<string, Comp>> {
  const T = ticker.toUpperCase()

  const candidates = SECTOR_PEERS[sector] ?? FALLBACK_PEERS
  const peers = candidates.filter((p) => p !== T).slice(0, 4)

  if (peers.length === 0) return HARDCODED_FALLBACK

  const results = await Promise.allSettled(peers.map((p) => fetchOneComp(p)))

  const comps: Record<string, Comp> = {}
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value !== null) {
      comps[peers[i]] = result.value
    }
  })

  return Object.keys(comps).length >= 2 ? comps : HARDCODED_FALLBACK
}
