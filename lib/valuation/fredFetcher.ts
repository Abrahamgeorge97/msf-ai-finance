/**
 * Server-only module.
 * Fetches the live 10-year US Treasury yield from FRED (Federal Reserve Bank of St. Louis).
 * No API key required — uses the public CSV endpoint.
 *
 * Series: DGS10 (Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity)
 * Updates: every business day, ~3pm ET
 * Fallback: 0.043 (4.3%) if fetch fails
 */

const FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10"
const FALLBACK_RF = 0.043

export interface FredResult {
  rf: number          // decimal, e.g. 0.0427 for 4.27%
  rfDate: string      // e.g. "2026-04-10"
  rfSource: "FRED"  | "fallback"
}

export async function fetchLiveRiskFreeRate(): Promise<FredResult> {
  try {
    const res = await fetch(FRED_URL, {
      next: { revalidate: 3_600 }, // cache 1 hour — yield doesn't move minute-by-minute
    } as RequestInit)

    if (!res.ok) throw new Error(`FRED returned ${res.status}`)

    const csv = await res.text()
    const lines = csv.trim().split("\n")

    // Find last non-empty, non-"." row (FRED uses "." for missing values)
    let rf = FALLBACK_RF
    let rfDate = ""

    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(",")
      if (parts.length < 2) continue
      const val = parts[1].trim()
      if (val === "." || val === "") continue
      const parsed = parseFloat(val) / 100  // FRED gives e.g. "4.27" → 0.0427
      if (isFinite(parsed) && parsed > 0) {
        rf = parsed
        rfDate = parts[0].trim()
        break
      }
    }

    return { rf, rfDate, rfSource: "FRED" }
  } catch {
    return { rf: FALLBACK_RF, rfDate: "", rfSource: "fallback" }
  }
}
