"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { NewsArticle } from "@/types/valuation"
import { cn } from "@/lib/utils"

// ── Sentiment styles ──────────────────────────────────────────────────────────

const SENTIMENT_BADGE: Record<string, { bg: string; text: string }> = {
  Positive: { bg: "bg-buy/20",   text: "text-buy" },
  Negative: { bg: "bg-sell/20",  text: "text-sell" },
  Neutral:  { bg: "bg-muted",    text: "text-muted-foreground" },
}

const CATEGORY_PILL_ACTIVE = "bg-[#e8473f] text-white border-[#e8473f]"
const CATEGORY_PILL_INACTIVE = "bg-transparent border-border text-muted-foreground hover:text-foreground"

// ── Multi-select filter strip ─────────────────────────────────────────────────

function FilterStrip({
  label,
  options,
  active,
  onToggle,
  onClearAll,
}: {
  label: string
  options: string[]
  active: Set<string>
  onToggle: (v: string) => void
  onClearAll: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Filter by {label}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map((opt) => {
          const isActive = active.has(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                isActive ? CATEGORY_PILL_ACTIVE : CATEGORY_PILL_INACTIVE,
              )}
            >
              {opt}
              {isActive && <X className="w-3 h-3 opacity-80" />}
            </button>
          )
        })}
        {/* Clear-all */}
        {active.size < options.length && (
          <button
            onClick={onClearAll}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Select all
          </button>
        )}
        {active.size > 0 && (
          <button
            onClick={() => options.forEach((o) => active.has(o) && onToggle(o))}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ticker: string
  companyName: string
  articles: NewsArticle[]
}

export function NewsTab({ ticker, companyName, articles }: Props) {
  // Derive unique categories and sentiments from articles
  const allCategories = Array.from(new Set(articles.map((a) => a.category ?? "General"))).sort()
  const allSentiments = ["Positive", "Neutral", "Negative"]

  // Multi-select state — all active by default
  const [activeCats,  setActiveCats]  = useState<Set<string>>(() => new Set(allCategories))
  const [activeSents, setActiveSents] = useState<Set<string>>(() => new Set(allSentiments))

  const toggleCat = (c: string) =>
    setActiveCats((prev) => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s })
  const toggleSent = (s: string) =>
    setActiveSents((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })

  const filtered = articles.filter(
    (a) =>
      activeCats.has(a.category  ?? "General") &&
      activeSents.has(a.sentiment ?? "Neutral"),
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          News — {companyName} ({ticker})
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent company news sourced from Yahoo Finance and Google News. Category and sentiment
          tags are auto-generated for context only and have no impact on valuation outputs.
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground rounded-lg border border-border">
          <p className="text-sm">No news articles available for {ticker}.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-card/30">
            <FilterStrip
              label="Category"
              options={allCategories}
              active={activeCats}
              onToggle={toggleCat}
              onClearAll={() => setActiveCats(new Set(allCategories))}
            />
            <FilterStrip
              label="Sentiment"
              options={allSentiments}
              active={activeSents}
              onToggle={toggleSent}
              onClearAll={() => setActiveSents(new Set(allSentiments))}
            />
          </div>

          {/* Article list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground rounded-lg border border-dashed border-border">
                <p className="text-sm">No articles match the selected filters.</p>
              </div>
            ) : (
              filtered.map((article, i) => {
                const sent = (article.sentiment ?? "Neutral") as keyof typeof SENTIMENT_BADGE
                const badge = SENTIMENT_BADGE[sent] ?? SENTIMENT_BADGE.Neutral
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card/50 hover:bg-card transition-colors p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: title + summary + meta */}
                      <div className="flex-1 min-w-0">
                        {article.url ? (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-sm text-blue-400 hover:text-blue-300 transition-colors leading-snug"
                          >
                            {article.title}
                          </a>
                        ) : (
                          <p className="font-semibold text-sm text-foreground leading-snug">
                            {article.title}
                          </p>
                        )}
                        {article.summary && article.summary !== article.title && (
                          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                            {article.summary}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground/60">
                          {[article.source, article.date, article.origin && `via ${article.origin}`]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                      </div>

                      {/* Right: sentiment badge + category */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span
                          className={cn(
                            "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                            badge.bg,
                            badge.text,
                          )}
                        >
                          {sent}
                        </span>
                        {article.category && (
                          <span className="text-xs text-muted-foreground">
                            {article.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer count */}
          <p className="text-xs text-center text-muted-foreground/60 pb-2">
            Showing {filtered.length} of {articles.length} articles · Sentiment is
            keyword-based, for context only
          </p>
        </>
      )}
    </div>
  )
}
