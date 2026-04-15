"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { OverviewTab } from "./tabs/OverviewTab"
import { FinancialStatementsTab } from "./tabs/FinancialStatementsTab"
import { ValuationModelsTab } from "./tabs/ValuationModelsTab"
import { QualityScoresTab } from "./tabs/QualityScoresTab"
import { NewsTab } from "./tabs/NewsTab"
import { AskAITab } from "./tabs/AskAITab"
import { ExportTab } from "./tabs/ExportTab"
import { computeAll } from "@/lib/valuation/calculations"
import type { ValuationConfig, NewsArticle } from "@/types/valuation"
import { cn } from "@/lib/utils"
import { SignalBadge } from "./shared/SignalBadge"
import {
  ValuationSummaryCard,
  deriveSummarySignal,
  type ValuationSummaryData,
} from "./ValuationSummaryCard"
import { useValuationConfidence } from "@/hooks/useValuationConfidence"
import { ScenarioProvider, ScenarioToggle, useScenario } from "@/context/ScenarioContext"
import { AssumptionsDrawer } from "./AssumptionsDrawer"
import { useAssumptionsDrawer } from "@/hooks/useAssumptionsDrawer"
import { ArrowLeft, Settings2, FileText, Users } from "lucide-react"
import Link from "next/link"
import type { Comp } from "@/types/valuation"

// ── Peer override panel ───────────────────────────────────────────────────────

function PeerOverridePanel({
  onCompsUpdate,
}: {
  onCompsUpdate: (comps: Record<string, Comp>) => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const tickers = input.trim()
    if (!tickers) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/peers?tickers=${encodeURIComponent(tickers)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      onCompsUpdate(data.comps)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load peers")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Override peer comparables"
      >
        <Users className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Peers</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-2 py-1">
      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="MSFT,GOOGL,META (comma-separated)"
        className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none w-44"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40"
      >
        {loading ? "…" : "Apply"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

type TopTab = "Overview" | "Financials" | "Valuation Models" | "Quality Scores" | "News" | "Export" | "Ask AI"
const TOP_TABS: TopTab[] = ["Overview", "Financials", "Valuation Models", "Quality Scores", "News", "Export", "Ask AI"]

interface SecFiling {
  date: string
  url: string
  accessionNumber: string
  companyName: string
}

interface Props {
  config: ValuationConfig
  news?: NewsArticle[]
  sec?: SecFiling | null
}

/** Public entry — wraps everything in ScenarioProvider */
export function ValuationDashboard({ config, news = [], sec = null }: Props) {
  return (
    <ScenarioProvider initial={config.default_assumptions}>
      <DashboardInner config={config} news={news} sec={sec} />
    </ScenarioProvider>
  )
}

/** Inner component — consumes ScenarioContext */
function DashboardInner({ config, news, sec }: Required<Props>) {
  const B = config.baseline
  const { assumptions, setAssumption } = useScenario()
  const [activeTab, setActiveTab] = useState<TopTab>("Overview")
  const [mcResults, setMcResults] = useState<Record<string, number[]>>({})
  const [comps, setComps] = useState<Record<string, Comp>>(config.comps)
  const drawer = useAssumptionsDrawer()

  const computed = useMemo(
    () =>
      computeAll(
        B,
        comps,
        config.segments,
        config.acquisitions,
        config.historical_is.eps,
        assumptions,
      ),
    [B, comps, config.segments, config.acquisitions, config.historical_is.eps, assumptions],
  )

  const confidence = useValuationConfidence({
    computed,
    historicalIS: config.historical_is,
    baseline: B,
  })

  const summaryData = useMemo<ValuationSummaryData>(() => {
    const { pps_fcff, pps_ebitda, pps_rev, pps_pe, pps_peg, pps_pb, pps_sotp } = computed
    const multiplesAvg =
      [pps_ebitda, pps_rev, pps_pe, pps_peg, pps_pb].reduce((a, b) => a + b, 0) / 5
    const intrinsic = pps_fcff * 0.35 + multiplesAvg * 0.45 + pps_sotp * 0.20
    const upsidePct = B.current_price > 0 ? ((intrinsic / B.current_price) - 1) * 100 : 0
    const mcArr = mcResults["FCFF (DCF)"]
    const mcMedian = mcArr?.length
      ? mcArr.slice().sort((a, b) => a - b)[Math.floor(mcArr.length / 2)]
      : null
    return {
      intrinsicValue: intrinsic,
      marketPrice: B.current_price,
      upsidePercent: upsidePct,
      signal: deriveSummarySignal(upsidePct),
      confidenceScore: confidence.score,
      confidenceFactors: confidence.factors,
      breakdown: { dcf: pps_fcff, multiplesAvg, mcMedian },
    }
  }, [computed, B.current_price, mcResults, confidence])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">
              {config.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {config.exchange}: {config.ticker}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {config.fiscal_year} · {config.currency} {config.units}
              </p>
              {sec && (
                <a
                  href={sec.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <FileText className="w-2.5 h-2.5" />
                  10-K {sec.date}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Global scenario toggle */}
        <ScenarioToggle className="hidden md:inline-flex" />

        {/* Top tabs */}
        <nav className="flex gap-1">
          {TOP_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Peer override */}
        <PeerOverridePanel onCompsUpdate={setComps} />

        {/* Right side: price + signal + drawer trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-sm font-semibold text-foreground">${B.current_price.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">{config.ticker}</p>
          </div>
          <SignalBadge signal={computed.finalSignal} size="md" />
          <button
            onClick={drawer.onOpen}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open assumptions"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <AssumptionsDrawer
        open={drawer.open}
        onOpenChange={drawer.setOpen}
        ticker={config.ticker}
        totalDebt={config.baseline.total_debt}
        marketCap={config.baseline.current_price * config.baseline.shares_diluted}
        rfNote={
          config.dataFlags?.rf_source === "FRED" && config.dataFlags.rf_date
            ? `Live from FRED · ${config.dataFlags.rf_date}`
            : "Using fallback default (4.30%)"
        }
        consensusNote={
          config.dataFlags?.consensus_available && config.dataFlags.consensus_analysts > 0
            ? `Pre-filled from ${config.dataFlags.consensus_analysts} analysts (FMP) — you can override`
            : undefined
        }
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
            >
              {activeTab === "Overview" && (
                <>
                  <div className="px-4 pt-4 pb-0">
                    <ValuationSummaryCard data={summaryData} ticker={config.ticker} />
                  </div>
                  <OverviewTab config={config} computed={computed} />
                </>
              )}
              {activeTab === "Financials" && (
                <FinancialStatementsTab config={config} />
              )}
              {activeTab === "Valuation Models" && (
                <ValuationModelsTab
                  config={{ ...config, comps }}
                  computed={computed}
                  assumptions={assumptions}
                  mcResults={mcResults}
                  onMcComplete={setMcResults}
                />
              )}
              {activeTab === "Quality Scores" && (
                <QualityScoresTab config={config} />
              )}
              {activeTab === "News" && (
                <NewsTab ticker={config.ticker} companyName={config.name} articles={news} />
              )}
              {activeTab === "Export" && (
                <ExportTab config={config} assumptions={assumptions} computed={computed} />
              )}
              {activeTab === "Ask AI" && (
                <AskAITab config={config} assumptions={assumptions} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
