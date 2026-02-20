# MSF AI Finance — Equity Valuation Terminal (v2)

A professional, browser-based equity research platform that automatically fetches live financial data from **SEC EDGAR XBRL** and **Yahoo Finance**, then runs **14 institutional-grade valuation models** to produce a consensus Buy / Hold / Sell signal with interactive visualisations, scenario analysis, and an AI-powered research assistant.

Built as the Next.js / TypeScript successor to the original Python / Streamlit platform, extending it with CFA Level 2 models, a real-time assumptions drawer, and a production-quality UI.

---

## Features

### Data Pipeline
- **SEC EDGAR XBRL API** — extracts structured GAAP data directly from 10-K filings using 20+ concept mappings with intelligent fallback chains
- **Yahoo Finance** — live market price, beta, and market cap (market data only)
- All extracted figures verified against Allegion plc FY2023 10-K (ALLE reference case)
- 1-hour server-side cache via Next.js `revalidate`

### 14 Valuation Models

| # | Model | Standard |
|---|-------|----------|
| 1 | FCFF (DCF) | CFA L1 |
| 2 | FCFE (DCF) | CFA L2 |
| 3 | Residual Income | CFA L2 |
| 4 | DDM — 2-Stage + H-Model | CFA L2 |
| 5 | EV/EBITDA Multiple | CFA L1 |
| 6 | EV/Revenue Multiple | CFA L1 |
| 7 | P/E Multiple | CFA L1 |
| 8 | Justified P/E | CFA L2 |
| 9 | PEG Ratio | CFA L1 |
| 10 | P/B Multiple | CFA L1 |
| 11 | Justified P/B | CFA L2 |
| 12 | P/CF Multiple | CFA L1 |
| 13 | SOTP (Sum-of-the-Parts) | IB standard |
| 14 | Football Field (composite) | IB standard |

### Consensus Signal System
- **BUY** — intrinsic value > market price + 15%
- **HOLD** — within ±15% of market price
- **SELL** — intrinsic value < market price − 15%
- Weighted consensus across all active models (zero-value models excluded)

### Scenario Analysis
Three pre-tuned assumption presets:

| Scenario | WACC | Yr1 Growth | Target EBITDA Margin | Exit Multiple |
|----------|------|------------|----------------------|---------------|
| Base | 8.5% | 2.5% | 27.0% | 14.0× |
| Bull | 7.5% | 4.5% | 30.0% | 17.0× |
| Bear | 10.0% | 0.5% | 23.0% | 11.0× |

Live assumptions are adjustable via the **Assumptions Drawer** (gear icon) including CAPM inputs (Rf, ERP, β, cost of debt) with real-time WACC display.

### Additional Features
- **News Tab** — Yahoo Finance + Google News RSS with keyword-based category and sentiment tagging
- **Ask AI Tab** — OpenAI `gpt-4o-mini` chatbot grounded in live company financials and active assumptions
- **Export Tab** — Word (.docx) and Excel (.xlsx) report generation
- **Sensitivity Tables** — every model tab includes a two-axis sensitivity analysis
- **Football Field Chart** — all 14 models visualised with weighted consensus overlay

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Charts | Recharts (interactive) |
| Animations | Framer Motion |
| AI | OpenAI SDK (`gpt-4o-mini`) |
| Data — Fundamentals | SEC EDGAR XBRL API |
| Data — Market | Yahoo Finance (`yahoo-finance2`) |
| Export | `docx`, `xlsx` |
| Testing | Vitest |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
git clone <repo-url>
cd valuation_web
npm install
```

### Environment Variables

Create a `.env.local` file in the project root (this file is **not included in the repo** — never commit API keys):

```env
OPENAI_API_KEY=sk-...          # Required for Ask AI tab (get one at platform.openai.com)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> The OpenAI key is only required for the Ask AI tab. All 14 valuation models, charts, news, and export work without it.

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter any US public equity ticker (e.g. `AAPL`, `MSFT`, `ALLE`) to load the valuation dashboard.

---

## Running Tests

```bash
npm test
```

For watch mode during development:

```bash
npm run test:watch
```

### Test Coverage

| Test File | What It Tests | Analogous Python Tests |
|-----------|--------------|----------------------|
| `__tests__/edgarXbrl.test.ts` | `pickAnnual`, `firstConcept` — XBRL filtering, fallback chains, deduplication | `TestExtractFact`, `TestGetAvailableFiscalYears` |
| `__tests__/newsFetcher.test.ts` | `categorize`, `sentiment` — keyword matching, case insensitivity | `TestCategorize`, `TestSentiment` |
| `__tests__/calculations.test.ts` | `computeWACC`, `computePCF`, `computeJustifiedPE`, `computeJustifiedPB`, `assignSignal`, formatters | `TestBuildBaseline` |

**Total: 57 test cases** covering the XBRL data pipeline, news processing, and CFA valuation model calculations.

---

## Project Structure

```
valuation_web/
├── app/
│   ├── page.tsx                    # Landing page — ticker input
│   ├── [ticker]/
│   │   └── page.tsx                # Per-ticker valuation page (server component)
│   └── api/
│       ├── ask/route.ts            # OpenAI chat API endpoint
│       └── data/route.ts           # Data fetching API endpoint
├── components/
│   └── valuation/
│       ├── ValuationDashboard.tsx  # Main dashboard shell
│       ├── ValuationSummaryCard.tsx # Consensus signal card
│       ├── AssumptionsDrawer.tsx   # CAPM + growth sliders
│       ├── FinanceTerminal.tsx     # Terminal-style AI chat UI
│       └── tabs/
│           ├── OverviewTab.tsx
│           ├── ValuationModelsTab.tsx
│           ├── NewsTab.tsx
│           ├── ExportTab.tsx
│           ├── AskAITab.tsx
│           └── models/
│               ├── DCFTab.tsx
│               ├── FCFETab.tsx
│               ├── ResidualIncomeTab.tsx
│               ├── DDMTab.tsx
│               ├── PETab.tsx
│               ├── EVEBITDATab.tsx
│               ├── PEGTab.tsx
│               ├── PBTab.tsx
│               ├── RevenueTab.tsx
│               ├── PCFTab.tsx
│               └── FootballFieldTab.tsx
├── lib/
│   └── valuation/
│       ├── edgarXbrl.ts            # SEC EDGAR XBRL fetcher (server-only)
│       ├── yahooFetcher.ts         # Yahoo Finance + data assembly (server-only)
│       ├── newsFetcher.ts          # News fetching + categorisation (server-only)
│       ├── dataFetcher.ts          # Top-level data orchestrator
│       ├── calculations.ts         # All 14 valuation model functions (pure)
│       └── presets.ts              # Scenario presets, CHART_COLORS
├── types/
│   └── valuation.ts                # Full TypeScript type definitions
├── context/
│   └── ScenarioContext.tsx         # Base/Bull/Bear scenario state
├── hooks/
│   ├── useValuationConfidence.ts
│   └── useAssumptionsDrawer.ts
├── __tests__/
│   ├── edgarXbrl.test.ts
│   ├── newsFetcher.test.ts
│   └── calculations.test.ts
├── vitest.config.ts
├── .env.local                      # API keys (not committed)
└── package.json
```

---

## Architecture

### XBRL Data Pipeline

The EDGAR XBRL pipeline (`lib/valuation/edgarXbrl.ts`) fetches the `companyfacts` JSON for a given CIK and extracts all financial line items using concept fallback arrays:

```
Revenue:  RevenueFromContractWithCustomerExcludingAssessedTax
          → Revenues → SalesRevenueNet → ...

D&A:      DepreciationDepletionAndAmortization
          → DepreciationAndAmortization → Depreciation

OCF:      NetCashProvidedByUsedInOperatingActivities
          → NetCashProvidedByOperatingActivities
```

**Annual IS filtering** (`pickAnnual`): retains only 10-K/10-K/A/20-F/40-F entries with a filing duration of 300–400 days, deduplicated per fiscal year-end (latest filed wins).

**Balance sheet alignment** (`pickInstant`): instant (point-in-time) facts are matched within ±7 days of each income statement fiscal year-end, keeping array lengths aligned across all series.

**Fallback behaviour**: if EDGAR returns no XBRL data (foreign ADRs, some small-caps), all fundamentals fall back to Yahoo Finance.

### CFA Valuation Functions

All model functions in `lib/valuation/calculations.ts` are pure functions — they take inputs and return outputs with no side effects or API calls:

```typescript
// WACC — CFA Level 1
computeWACC(rf, beta, erp, kd, T, marketCap, totalDebt)
  → { wacc, ke, kd_after_tax }

// FCFE — CFA Level 2
computeFCFE(proforma, baseline, assumptions, ke)
  → { pps_fcfe, ev_fcfe, fcfes }

// Residual Income — CFA Level 2 (clean surplus)
computeRI(baseline, assumptions, ke)
  → { pps_ri, riRows }

// H-Model DDM — CFA Level 2
computeHModelDDM(baseline, assumptions, ke)
  → pps_hddm

// Justified P/E — CFA Level 2
computeJustifiedPE(baseline, assumptions, ke)
  → { pps_jpe, justifiedPE }

// Justified P/B — CFA Level 2
computeJustifiedPB(baseline, assumptions, ke)
  → { pps_jpb, justifiedPB }

// P/CF — CFA Level 1
computePCF(baseline, medianPcf)
  → { pps_pcf, cfoPerShare }
```

### Football Field Weights

The composite consensus weights (must sum to 1.0):

| Model | Weight |
|-------|--------|
| FCFF (DCF) | 20% |
| FCFE (DCF) | 10% |
| Residual Income | 10% |
| EV/EBITDA | 12% |
| P/E | 8% |
| Justified P/E | 7% |
| Justified P/B | 5% |
| P/CF | 7% |
| DDM | 3% |
| H-Model DDM | 2% |
| PEG | 3% |
| P/B | 3% |
| Revenue | 5% |
| SOTP | 5% |

---

## Caveats

- **US equities only** — XBRL data is available for SEC-registered companies. Foreign ADRs fall back to Yahoo Finance.
- **Static peer comps** — peer multiples are placeholder values (Peer A–D). Real peer group screening by SIC code is a future enhancement.
- **Price is fetched at load time** — does not refresh live during the session.
- **SOTP requires a custom config** — segment-level valuation works best when segment revenue and margins are provided via a JSON config override in `/public/data/{TICKER}.json`.

---

## Reference Case

The platform ships with `ALLE` (Allegion plc) as a verified reference case. All figures extracted from EDGAR XBRL were verified against the actual FY2023 10-K filing — revenue, EBITDA, net income, EPS, DPS, D&A, CapEx, net debt, and shares outstanding all match exactly.

---

## Acknowledgements

- [SEC EDGAR XBRL API](https://www.sec.gov/developer) — free, authoritative source of GAAP financial data
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) — live market data
- [CFA Institute Curriculum](https://www.cfainstitute.org) — valuation model frameworks
- [Damodaran Online](https://pages.stern.nyu.edu/~adamodar/) — reference for valuation methodology
