"use client"

import { useEffect, useState } from "react"
import { ValuationDashboard } from "@/components/valuation/ValuationDashboard"
import type { ValuationConfig, NewsArticle } from "@/types/valuation"

interface SecFiling {
  date: string
  url: string
  accessionNumber: string
  companyName: string
}

interface Props {
  ticker: string
  serverConfig: ValuationConfig
  news: NewsArticle[]
  sec: SecFiling | null
}

export function TickerPageClient({ ticker, serverConfig, news, sec }: Props) {
  const [config, setConfig] = useState<ValuationConfig>(serverConfig)

  useEffect(() => {
    // Prefer any user-uploaded custom config stored in localStorage
    const stored = localStorage.getItem(`msf_config_${ticker}`)
    if (stored) {
      try {
        const parsed: ValuationConfig = JSON.parse(stored)
        if (parsed.ticker === ticker) setConfig(parsed)
      } catch { /* fall through to serverConfig */ }
    }
  }, [ticker, serverConfig])

  return <ValuationDashboard config={config} news={news} sec={sec} />
}
