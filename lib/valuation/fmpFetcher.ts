/**
 * Server-only module. Do NOT import in client components.
 * Fetches analyst consensus revenue estimates from Financial Modeling Prep (FMP).
 *
 * Free tier: 250 requests/day at financialmodelingprep.com.
 * Requires FMP_API_KEY in .env.local.  Returns null gracefully when key is absent.
 */

const FMP_BASE = "https://financialmodelingprep.com/api/v3"

export interface ConsensusResult {
  yr1_g: number    // year-1 revenue growth rate (decimal, e.g. 0.12 = +12%)
  yr2_g: number
  yr3_g: number
  analysts: number // # analysts covering revenue
  source: "FMP"
}

interface FmpEstimate {
  symbol: string
  date: string                              // fiscal year end date, e.g. "2026-09-30"
  estimatedRevenueAvg: number               // raw USD (not millions)
  estimatedRevenueLow: number
  estimatedRevenueHigh: number
  estimatedEbitdaAvg: number
  estimatedEpsAvg: number
  numberAnalystEstimatedRevenue: number
  numberAnalystsEstimatedEps: number
}

/**
 * Fetch FMP analyst consensus revenue estimates and convert to growth rates.
 *
 * @param ticker           - Stock ticker (e.g. "AAPL")
 * @param baselineRevenueMn - Current LTM or annual revenue in **millions**
 * @returns growth rates and analyst count, or null on error / missing key
 */
export async function fetchConsensusEstimates(
  ticker: string,
  baselineRevenueMn: number,
): Promise<ConsensusResult | null> {
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey || apiKey === "your-fmp-api-key-here") return null
  if (baselineRevenueMn <= 0) return null

  try {
    const url = `${FMP_BASE}/analyst-estimates/${ticker.toUpperCase()}?apikey=${apiKey}&period=annual`
    const res = await fetch(url, {
      next: { revalidate: 86_400 }, // cache 24 h
    } as RequestInit)

    if (!res.ok) return null

    const raw: unknown = await res.json()
    if (!Array.isArray(raw) || raw.length === 0) return null

    // Filter to future fiscal year estimates and sort oldest-first
    const today = new Date().toISOString().slice(0, 10)
    const future = (raw as FmpEstimate[])
      .filter((e) => e.date >= today && e.estimatedRevenueAvg > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (future.length < 2) return null

    // FMP returns raw USD; convert our millions baseline to raw for comparison
    const baselineRaw = baselineRevenueMn * 1_000_000

    const yr1_g = (future[0].estimatedRevenueAvg / baselineRaw) - 1
    const yr2_g = (future[1].estimatedRevenueAvg / future[0].estimatedRevenueAvg) - 1
    // Year 3: use estimate if available, else gently taper yr2
    const yr3_g = future.length >= 3
      ? (future[2].estimatedRevenueAvg / future[1].estimatedRevenueAvg) - 1
      : yr2_g * 0.85

    // Reject implausible rates (data quality guard)
    if (Math.abs(yr1_g) > 1.5 || Math.abs(yr2_g) > 1.5) return null

    const analysts = future[0].numberAnalystEstimatedRevenue ?? 0

    return { yr1_g, yr2_g, yr3_g, analysts, source: "FMP" }
  } catch {
    return null
  }
}
