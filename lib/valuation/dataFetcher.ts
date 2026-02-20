import type { ValuationConfig, NewsArticle } from "@/types/valuation"
import { fetchLiveConfig } from "./yahooFetcher"

export async function fetchConfig(ticker: string): Promise<{
  config: ValuationConfig | null
  news: NewsArticle[]
  sec: { date: string; url: string; accessionNumber: string; companyName: string } | null
}> {
  // 1. Try a static override file first (drop TICKER.json in /public/data/ to override)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const res = await fetch(`${baseUrl}/data/${ticker}.json`, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      return { config: json.config ?? json, news: json.news ?? [], sec: null }
    }
  } catch { /* fall through */ }

  // 2. Live data: Yahoo Finance + SEC EDGAR
  try {
    const { config, sec, news } = await fetchLiveConfig(ticker)
    return { config, news, sec }
  } catch (err) {
    console.error(`[fetchConfig/${ticker}] Yahoo fetch failed:`, err)
    return { config: null, news: [], sec: null }
  }
}
