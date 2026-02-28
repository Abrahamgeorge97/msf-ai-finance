# Changelog — MSF AI Finance · Equity Valuation Terminal

Documents the five iterative development stages of the platform, from a minimal data-fetch prototype to a production-grade valuation terminal.

---

## Stage 5 — Data Quality (Current)

**Commits:** `8f9f416`, `757cdba`

**Scope:** Replaced static placeholder data with live, ticker-specific data.

### Live Sector Peer Comps (`peerFetcher.ts`)
- Created `peerFetcher.ts` with an 11-sector GICS map (10 candidate tickers per sector)
- `fetchPeerComps(ticker, sector)` selects 4 peers, fetches live multiples in parallel via Yahoo Finance
- Multiples fetched per peer: EV/EBITDA, EV/Revenue, P/E, PEG, P/B, P/CF
- Integrated into second `Promise.all` batch in `yahooFetcher.ts` — zero latency overhead
- Falls back to static Peer A–D if fewer than 2 live fetches succeed
- Affects all 6 multiple-based valuation models (EV/EBITDA, EV/Rev, P/E, PEG, P/B, P/CF)

### Per-Year D&A for Historical EBITDA (`edgarXbrl.ts`, `yahooFetcher.ts`)
- Added 3 additional XBRL concept fallbacks for D&A
- Added `da: number[]` per-year array to `hist` in `XbrlFundamentals`
- Applied `revenue × 3%` fallback when all XBRL D&A concepts return zero
- Rewrote historical EBITDA as `ebit[i] + da[i]` per year (previously used one static `da_total` across all years)
- Recomputed current `ebitda` from `operatingInc + da` to reflect the fallback

---

## Stage 4 — Analysis Depth

**Commits:** `31662cb`, `4d0e57e`, `768fbfa`, `14960be`

**Scope:** Added forensic accounting signals and balance sheet analysis.

### Financial Statements Tab
- Historical income statement, balance sheet, and cash flow statement tables
- 5-year trend data sourced from XBRL `hist` arrays
- Revenue, EBITDA, net income, EPS, OCF, CapEx, net debt displayed year-by-year

### Quality Scores Tab (Altman Z / Piotroski F / Beneish M)
- **Altman Z-Score** — bankruptcy risk predictor (Z > 2.99 = safe zone)
- **Piotroski F-Score** — 9-point financial strength signal (F ≥ 7 = strong)
- **Beneish M-Score** — earnings manipulation detector (M > −1.78 = manipulator flag)
- Each score displayed with threshold interpretation and component drill-down

### Production Fixes
- VERCEL_URL environment variable for static data fallback in production
- Hydration mismatch fix (locale-safe number formatting)
- TypeScript strict-mode build errors resolved for Vercel deployment

---

## Stage 3 — Deliverable Features

**Commit:** `fecc6f0`

**Scope:** Added export pipeline and SOTP valuation model.

### Word / Excel Export (`ExportTab.tsx`)
- **Word (.docx)** — full valuation report using the `docx` library: cover page, executive summary, all 14 model outputs, assumptions, peer comps table, football field chart description
- **Excel (.xlsx)** — structured workbook with tabs: Baseline, Historical IS, Valuation Models, Peer Comps, Assumptions

### SOTP — Sum-of-the-Parts (`SOTPTab.tsx`)
- Interactive segment table: edit revenue, EBITDA margin, and EV/EBITDA multiple per segment inline
- Initialises from `config.segments` (from SEC EDGAR segment disclosures or custom JSON)
- EV Bridge: Σ(Segment EV) → Less Net Debt → Equity Value → Price/Share
- Donut chart showing each segment's % contribution to total EV
- Single-axis sensitivity table: global EV/EBITDA multiple ±3× vs implied price
- Conglomerate guidance: documents when SOTP applies and reference multiples by sector

---

## Stage 2 — Advanced Models

**Commit:** `e4f15c1`

**Scope:** Extended from 8 basic models to 14 CFA/IB-standard models with simulation capabilities.

### New Valuation Models
- **FCFE (CFA L2)** — free cash flow to equity with leverage adjustment
- **Residual Income (CFA L2)** — clean surplus accounting; RI = NI − (ke × BV)
- **H-Model DDM (CFA L2)** — two-stage dividend discount with smooth growth transition
- **Justified P/E (CFA L2)** — `P/E = (1 − b) / (r − g)` from first principles
- **Justified P/B (CFA L2)** — `P/B = (ROE − g) / (r − g)`

### Monte Carlo Simulation
- 10,000-path DCF simulation with configurable σ on revenue growth and WACC
- Output: price distribution histogram, 5th/50th/95th percentile, probability above market price

### Reverse DCF
- Bisection algorithm solves for the implied growth rate embedded in current market price
- Output: implied WACC-adjusted perpetuity growth rate vs user's assumed growth

### Scenario Analysis Tab
- Three pre-tuned presets: Base / Bull / Bear
- Side-by-side model output comparison across all three scenarios
- Scenario probability weighting for composite intrinsic value

### Streaming AI Chat
- Server-Sent Events (SSE) streaming from OpenAI `gpt-4o-mini`
- Prompt grounded in live company financials and active assumptions

---

## Stage 1 — Core Platform

**Commit:** `bef40be`

**Scope:** Minimum viable valuation terminal: data pipeline + 8 models + UI shell.

### SEC EDGAR XBRL Data Pipeline (`edgarXbrl.ts`)
- CIK lookup via EDGAR full-text search API
- `companyfacts` JSON fetch with 20+ concept fallback chains per line item
- `pickAnnual()`: filters to 10-K/20-F/40-F duration entries (300–400 days), deduplicates per fiscal year-end
- `pickInstant()`: aligns balance sheet facts within ±7 days of income statement fiscal year-ends
- `alignToMaster()`: aligns all IS/CF arrays to the revenue timeline (tolerance: 35 days)
- 5-year historical arrays: revenue, EBIT, net income, EPS, DPS, OCF, CapEx, BVPS, D&A

### Yahoo Finance Integration (`yahooFetcher.ts`)
- Live price, beta, shares outstanding, book value per share
- Two-batch parallel fetch: (Yahoo + CIK lookup) → (10-K metadata + XBRL + news + peer comps)
- 1-hour server-side revalidation cache via Next.js `next: { revalidate: 3600 }`

### 8 Base Valuation Models
| Model | Standard |
|-------|----------|
| FCFF (DCF) | CFA L1 |
| EV/EBITDA Multiple | CFA L1 |
| EV/Revenue Multiple | CFA L1 |
| P/E Multiple | CFA L1 |
| PEG Ratio | CFA L1 |
| P/B Multiple | CFA L1 |
| P/CF Multiple | CFA L1 |
| Football Field (composite) | IB standard |

### UI Shell
- Next.js 16 App Router, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion
- Per-ticker server component (`app/[ticker]/page.tsx`) — SSR with streaming
- `AssumptionsDrawer` — CAPM sliders (Rf, β, ERP, Kd) with live WACC display
- `ValuationSummaryCard` — consensus BUY/HOLD/SELL with 4-factor confidence score
- S&P 500 infinite ticker slider on landing page (503 tickers, GPU-accelerated CSS)
- Saved company profiles (localStorage) and custom JSON config upload

### Testing Foundation (57 test cases)
- `edgarXbrl.test.ts` — XBRL filtering, fallback chains, deduplication logic
- `newsFetcher.test.ts` — categorisation and sentiment keyword matching
- `calculations.test.ts` — WACC, PCF, Justified P/E, Justified P/B, signal assignment

---

*All five stages are reflected in the git commit history of this repository.*
