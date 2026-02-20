/**
 * Server-only module. Do NOT import in client components.
 * Fetches news from Yahoo Finance (primary) + Google News RSS (fallback).
 * Keyword-based auto-categorization and sentiment — for context only.
 */

import YahooFinance from "yahoo-finance2"
import type { NewsArticle } from "@/types/valuation"

const yahooFinance = new YahooFinance()

// ── Keyword dictionaries (ported from data_pipeline.py) ───────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Earnings:         ["earnings", "quarterly", "Q1 ", "Q2 ", "Q3 ", "Q4 ", "EPS", "beat", "miss", "quarterly results", "profit report"],
  Guidance:         ["guidance", "outlook", "forecast", "raises", "lowers", "expects", "projects", "full-year", "full year"],
  "M&A":            ["acquisition", "acquire", "merger", "takeover", "deal", "purchase", "divest", "spin-off", "spinoff"],
  Regulation:       ["regulation", "regulatory", "FDA", "SEC", "antitrust", "compliance", "approval", "ruling", "investigation"],
  "Product Strategy":["product", "launch", "innovation", "patent", "new model", "technology", "R&D", "pipeline"],
  Litigation:       ["lawsuit", "litigation", "settlement", "court", "sue", "legal", "verdict", "indictment"],
  "Macro Exposure": ["inflation", "interest rate", "fed ", "federal reserve", "recession", "economy", "tariff", "trade war", "GDP"],
}

const POSITIVE_KW = [
  "beat", "raise", "upgrade", "strong", "growth", "record", "surge",
  "rally", "gain", "exceed", "outperform", "positive", "bullish",
  "higher", "boost", "profit", "win",
]

const NEGATIVE_KW = [
  "miss", "lower", "downgrade", "weak", "decline", "cut", "warning",
  "loss", "fall", "below", "underperform", "negative", "bearish",
  "slump", "drop", "risk", "concern",
]

// exported for unit testing
export function categorize(text: string): string {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return category
    }
  }
  return "General"
}

// exported for unit testing
export function sentiment(text: string): "Positive" | "Negative" | "Neutral" {
  const lower = text.toLowerCase()
  const pos = POSITIVE_KW.filter((kw) => lower.includes(kw)).length
  const neg = NEGATIVE_KW.filter((kw) => lower.includes(kw)).length
  if (pos > neg) return "Positive"
  if (neg > pos) return "Negative"
  return "Neutral"
}

function formatDate(d: Date | number | string | undefined): string {
  if (!d) return ""
  try {
    const date = d instanceof Date ? d : new Date(typeof d === "number" ? d * 1000 : d)
    return date.toISOString()
  } catch {
    return String(d)
  }
}

// ── Yahoo Finance news ────────────────────────────────────────────────────────

async function fetchYahooNews(ticker: string): Promise<NewsArticle[]> {
  try {
    const result = await yahooFinance.search(ticker, {
      newsCount: 15,
      quotesCount: 0,
    })
    const news = result.news ?? []
    return news.map((item) => {
      const text = item.title ?? ""
      return {
        title:     item.title     ?? "",
        source:    item.publisher ?? "Yahoo Finance",
        date:      formatDate(item.providerPublishTime),
        url:       item.link      ?? "",
        summary:   item.title     ?? "",  // Yahoo search doesn't return summaries
        category:  categorize(text),
        sentiment: sentiment(text),
        origin:    "Yahoo Finance",
      }
    })
  } catch {
    return []
  }
}

// ── Google News RSS fallback ──────────────────────────────────────────────────

function parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; source: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string; source: string }> = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"))
      return m ? m[1].trim() : ""
    }
    const sourceMatch = block.match(/<source[^>]*>([^<]+)<\/source>/i)

    items.push({
      title:       get("title"),
      link:        get("link") || block.match(/<link\s*\/>?\s*([^<]+)/)?.[1]?.trim() || "",
      description: get("description"),
      pubDate:     get("pubDate"),
      source:      sourceMatch ? sourceMatch[1].trim() : "Google News",
    })
  }
  return items
}

async function fetchGoogleNews(query: string): Promise<NewsArticle[]> {
  try {
    const encoded = encodeURIComponent(`${query} stock`)
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`
    const res = await fetch(url, {
      headers: { "User-Agent": "MSF-AI-Finance/1.0" },
      next: { revalidate: 1800 },
    } as RequestInit)
    if (!res.ok) return []
    const xml = await res.text()
    const items = parseRssItems(xml)

    return items.slice(0, 15).map((item) => {
      const text = item.title + " " + item.description
      // Strip HTML tags from description
      const summary = item.description.replace(/<[^>]+>/g, "").slice(0, 300)
      return {
        title:     item.title,
        source:    item.source,
        date:      item.pubDate,
        url:       item.link,
        summary:   summary || item.title,
        category:  categorize(text),
        sentiment: sentiment(text),
        origin:    "Google News",
      }
    })
  } catch {
    return []
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchNews(ticker: string, companyName = ""): Promise<NewsArticle[]> {
  const yahoo = await fetchYahooNews(ticker)

  // Use Google News as fallback/supplement if Yahoo returns < 5 articles
  const articles: NewsArticle[] = [...yahoo]
  if (articles.length < 5) {
    const query = companyName || ticker
    const google = await fetchGoogleNews(query)
    // Deduplicate by title
    const existingTitles = new Set(articles.map((a) => a.title))
    for (const a of google) {
      if (!existingTitles.has(a.title)) {
        articles.push(a)
        existingTitles.add(a.title)
      }
    }
  }

  return articles.slice(0, 20)
}
