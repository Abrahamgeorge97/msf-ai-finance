import Link from "next/link"
import { SP500Ticker } from "@/components/ui/sp500-ticker"
import TickerSubmit from "./TickerSubmit"
import { SavedProfilesSection, UploadConfigSection } from "./LandingClientSections"

const SAMPLE_TICKERS = ["AAPL", "MSFT", "GOOGL", "META", "AMZN", "NVDA", "JPM", "V"]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/40">
        {/* Ticker strip */}
        <div className="py-2 border-t border-border/20 mt-4">
          <SP500Ticker speed={52} />
        </div>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-12 text-center gap-8">
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-7xl font-bold tracking-tight text-foreground">
            Equity Valuation<br />Terminal
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Enter any US ticker to load SEC EDGAR data and run 14 institutional-grade valuation models.
          </p>
        </div>

        {/* Search */}
        <form className="flex gap-2 w-full max-w-md">
          <input
            name="ticker"
            placeholder="Enter ticker — AAPL, MSFT, NVDA…"
            autoComplete="off"
            className="flex-1 rounded-lg border border-border bg-card px-5 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring uppercase tracking-widest"
          />
          <TickerSubmit />
        </form>

        {/* Quick access */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quick access</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLE_TICKERS.map((t) => (
              <Link
                key={t}
                href={`/${t}`}
                className="px-4 py-2 rounded-full border border-border text-sm font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-md h-px bg-border/40" />

        {/* Saved profiles */}
        <SavedProfilesSection />

        {/* Upload */}
        <UploadConfigSection />

      </div>

    </main>
  )
}
