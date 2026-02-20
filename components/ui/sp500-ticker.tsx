"use client"

import { InfiniteSlider } from "./infinite-slider"
import { cn } from "@/lib/utils"

// ── S&P 500 constituents (503 tickers, Jan 2025) ──────────────────────────────

export const SP500_TICKERS: string[] = [
  // A
  "A", "AAL", "AAPL", "ABBV", "ABT", "ACGL", "ACN", "ADBE", "ADI", "ADM",
  "ADP", "ADSK", "AEE", "AEP", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM",
  "ALB", "ALGN", "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP",
  "AMT", "AMZN", "ANET", "ANSS", "AON", "AOS", "APA", "APD", "APH", "APP",
  "APTV", "ARE", "ATO", "AVB", "AVGO", "AVY", "AXON", "AXP", "AZO",
  // B
  "BA", "BAC", "BALL", "BAX", "BBY", "BDX", "BEN", "BF.B", "BIIB", "BIO",
  "BK", "BKR", "BLK", "BLDR", "BMY", "BR", "BRK.B", "BRO", "BSX", "BX",
  "BXP", "BWA",
  // C
  "CAG", "CAH", "CARR", "CAT", "CB", "CBOE", "CBRE", "CCI", "CCL", "CDNS",
  "CDW", "CE", "CEG", "CF", "CFG", "CHD", "CHTR", "CI", "CINF", "CL",
  "CLX", "CMCSA", "CME", "CMG", "CMI", "CMS", "CNC", "COF", "COO", "COP",
  "COR", "COST", "CPAY", "CPB", "CPT", "CPRT", "CRL", "CRM", "CRWD", "CSX",
  "CSGP", "CTLT", "CTSH", "CTVA", "CVS", "CVX", "CZR",
  // D
  "D", "DAL", "DAY", "DD", "DE", "DECK", "DFS", "DG", "DHI", "DHR",
  "DLR", "DLTR", "DOC", "DOV", "DOW", "DPZ", "DRI", "DTE", "DUK", "DVA",
  "DVN", "DXCM",
  // E
  "EA", "EBAY", "ECL", "ED", "EFX", "EIX", "EL", "ELV", "EMN", "EMR",
  "ENPH", "EOG", "EPAM", "EQR", "EQT", "EQIX", "ESS", "ETN", "ETR", "ETSY",
  "EW", "EXC", "EXPE", "EXPD", "EXR", "EG", "ES",
  // F
  "F", "FANG", "FAST", "FCX", "FDX", "FE", "FFIV", "FICO", "FI", "FIS",
  "FITB", "FOXA", "FOX", "FRT", "FSLR", "FTNT", "FTV",
  // G
  "GD", "GE", "GEHC", "GEN", "GEV", "GILD", "GIS", "GLW", "GM", "GNRC",
  "GOOG", "GOOGL", "GPC", "GS", "GWW",
  // H
  "HAL", "HAS", "HCA", "HD", "HES", "HIG", "HII", "HLT", "HOLX", "HON",
  "HPE", "HPQ", "HRL", "HSIC", "HST", "HSY", "HBAN", "HUM", "HWM",
  // I
  "IBM", "ICE", "IDXX", "IEX", "IFF", "INTC", "INTU", "INVH", "IP", "IPG",
  "IQV", "IR", "IRM", "ISRG", "IT", "ITW", "IVZ", "INCY",
  // J
  "J", "JBHT", "JBL", "JCI", "JKHY", "JNJ", "JPM", "JNPR",
  // K
  "K", "KDP", "KEY", "KEYS", "KHC", "KIM", "KLAC", "KMB", "KMI", "KMX",
  "KO", "KR", "KVUE",
  // L
  "L", "LDOS", "LEN", "LH", "LHX", "LIN", "LKQ", "LLY", "LMT", "LOW",
  "LRCX", "LULU", "LUV", "LVS", "LW", "LYB", "LYV",
  // M
  "MA", "MAA", "MAR", "MAS", "MCD", "MCHP", "MCK", "MCO", "MDLZ", "MDT",
  "MET", "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC", "MMM", "MNST",
  "MOH", "MO", "MOS", "MPWR", "MPC", "MRK", "MRO", "MRNA", "MS", "MSCI",
  "MSFT", "MSI", "MTB", "MTCH", "MTD", "MU",
  // N
  "NDAQ", "NCLH", "NDSN", "NEE", "NEM", "NFLX", "NI", "NKE", "NOC", "NRG",
  "NSC", "NTAP", "NTRS", "NUE", "NVDA", "NVR", "NWSA", "NWS", "NXPI",
  // O
  "O", "ODFL", "OKE", "OMC", "ON", "ORCL", "ORLY", "OTIS", "OXY",
  // P
  "PANW", "PAYC", "PAYX", "PCAR", "PCG", "PEG", "PEP", "PFE", "PFG",
  "PG", "PGR", "PH", "PHM", "PKG", "PLD", "PLT", "PLTR", "PM", "PNC",
  "PNR", "PNW", "POOL", "PPG", "PPL", "PRU", "PSA", "PSX", "PTC", "PWR",
  "PYPL",
  // Q
  "QCOM", "QRVO",
  // R
  "RL", "REG", "REGN", "RF", "RJF", "RMD", "ROK", "ROL", "ROP", "ROST",
  "RSG", "RTX", "RCL", "RVTY",
  // S
  "SBAC", "SBUX", "SCHW", "SHW", "SJM", "SLB", "SMCI", "SNA", "SNPS",
  "SO", "SOLV", "SPGI", "SPG", "SRE", "STT", "STLD", "STE", "STX", "STZ",
  "SWK", "SWKS", "SYF", "SYK", "SYY",
  // T
  "T", "TAP", "TDG", "TDY", "TECH", "TEL", "TER", "TFC", "TFX", "TGT",
  "TMO", "TMUS", "TPR", "TJX", "TRGP", "TRV", "TRMB", "TROW", "TSCO",
  "TSLA", "TT", "TTWO", "TSN", "TXN", "TXT", "TYL",
  // U
  "UAL", "UBER", "UDR", "UHS", "UNH", "UNP", "UPS", "URI", "USB",
  // V
  "V", "VLO", "VLTO", "VMC", "VRSN", "VRSK", "VRTX", "VST", "VTR", "VZ",
  // W
  "WAB", "WAT", "WBA", "WBD", "WDC", "WEC", "WELL", "WFC", "WHR", "WM",
  "WMB", "WMT", "WRB", "WST", "WTW", "WYNN",
  // X – Z
  "XEL", "XOM", "XRAY", "XYL", "YUM", "ZBRA", "ZBH", "ZTS",
]

// ── Single ticker chip ────────────────────────────────────────────────────────

function TickerChip({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex items-center gap-6 px-4">
      <span
        className={cn(
          "text-[11px] font-semibold tracking-[0.18em] uppercase",
          "text-foreground/60 select-none cursor-default",
          "transition-all duration-200",
          "hover:text-foreground hover:scale-105",
        )}
      >
        {symbol}
      </span>
      <span className="text-foreground/20 text-xs select-none">•</span>
    </span>
  )
}

// ── Ticker strip ──────────────────────────────────────────────────────────────

interface SP500TickerProps {
  speed?: number
  speedOnHover?: number
  reverse?: boolean
  className?: string
}

export function SP500Ticker({
  speed = 55,
  speedOnHover = 18,
  reverse = false,
  className,
}: SP500TickerProps) {
  return (
    <div
      role="marquee"
      aria-label="S&P 500 companies"
      className={cn("w-full py-2", className)}
    >
      <InfiniteSlider speed={speed} speedOnHover={speedOnHover} reverse={reverse}>
        {SP500_TICKERS.map((ticker) => (
          <TickerChip key={ticker} symbol={ticker} />
        ))}
      </InfiniteSlider>
    </div>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────

interface SP500HeroSectionProps {
  className?: string
}

export function SP500HeroSection({ className }: SP500HeroSectionProps) {
  return (
    <section className={cn("w-full space-y-6 py-12", className)}>
      <div className="text-center space-y-1.5 px-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Market Coverage
        </p>
        <h2 className="text-2xl font-bold text-foreground">Tracking the S&P 500</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The 500 largest US companies by market cap — covering ~80% of total US
          equity market value.
        </p>
      </div>

      {/* Two rows — one forward, one reversed, slightly different speeds */}
      <div className="space-y-1">
        <SP500Ticker speed={52} />
        <SP500Ticker speed={44} reverse />
      </div>
    </section>
  )
}
