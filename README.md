# MSF AI Finance — Equity Valuation Terminal

> *"Seconds, Not Hours: What Happens When a Finance Student Replaces the Analyst's Excel Model"*
> — [Read the Substack post](https://substack.com/home/post/p-189725846)

**Live App:** [valuationweb.vercel.app](https://valuationweb.vercel.app)

14 institutional-grade valuation models running simultaneously on any US-listed stock, powered by live SEC EDGAR data.

![CI](https://github.com/Abrahamgeorge97/msf-ai-finance/actions/workflows/ci.yml/badge.svg)

---

## What It Does

Enter any US ticker (AAPL, MSFT, GOOGL...) and get a full institutional valuation in ~10 seconds:

- **14 CFA-standard valuation models** computed simultaneously
- **Live data** pulled directly from SEC EDGAR XBRL filings (no stale CSV files)
- **Monte Carlo simulation** (5,000 runs) for probabilistic price ranges
- **Earnings quality scoring** — Piotroski F, Altman Z, Beneish M, DuPont
- **AI-powered analysis** via GPT-4o-mini Ask AI tab
- **Scenario analysis** — Base / Bull / Bear with live recalculation

---

## Valuation Models

| Category | Models |
|---|---|
| DCF | FCFF, FCFE, Reverse DCF |
| Dividend | DDM 2-Stage, H-Model DDM |
| Income | Residual Income (Clean Surplus) |
| Multiples | EV/EBITDA, Revenue, P/E, PEG, P/B, P/CF |
| Justified | Justified P/E, Justified P/B |
| Sum-of-Parts | SOTP (conglomerate segments) |
| Simulation | Monte Carlo (5,000 paths) |

---

## Quality Scores

| Model | What It Measures |
|---|---|
| Piotroski F-Score | 9-signal profitability & leverage screen |
| Altman Z-Score | Bankruptcy prediction (Altman 1968) |
| Beneish M-Score | Earnings manipulation detection (Beneish 1999) |
| DuPont Analysis | ROE decomposition — margin × turnover × leverage |
| Cash Flow Quality | Sloan accrual ratio, FCF conversion, OCF/NI |
| Earnings Flags | 8 forensic accounting red flags |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Framer Motion, Recharts |
| Data — Fundamentals | SEC EDGAR XBRL API (20+ concept fallbacks) |
| Data — Market | yahoo-finance2 v3 (price, beta, shares) |
| Data — Peers | Live sector peer comps (11 GICS sectors) |
| AI | OpenAI GPT-4o-mini |
| Testing | Vitest (77 unit tests) |
| CI/CD | GitHub Actions → Vercel |

---

## CI/CD Pipeline

Every push to `master` automatically:

```
Push → GitHub Actions
         ├── Run Tests (77 unit tests via Vitest)
         └── Build Check (Next.js + TypeScript)
                  └── Vercel Auto-Deploy
```

Tests must pass before the build runs. Build must pass before Vercel deploys.

---

## Data Architecture

```
SEC EDGAR XBRL API
  └── 20+ concept fallbacks per field
  └── Annual/instant fact disambiguation
  └── Per-year D&A, EBITDA, OCF, CapEx arrays

Yahoo Finance (yahoo-finance2 v3)
  └── Live price, beta, shares, EPS, DPS, BVPS

Live Peer Comps (peerFetcher.ts)
  └── 11 GICS sectors × 10 candidate tickers
  └── 4 peers selected per ticker
  └── EV/EBITDA, P/E, PEG, P/B, P/CF multiples
```

---

## Validation

- **77/77 unit tests passing** — pure functions in `calculations.ts` tested independently
- **TypeScript strict mode** — zero type errors on every build
- **CI enforced** — no broken code can reach production
- **CFA L3 review** — 16 analytical issues identified and fixed:
  - FCFF correctly deducts ΔNWC
  - DDM discounts at CAPM-derived ke (not manual override)
  - P/E and PEG use NTM forward EPS
  - Monte Carlo uses additive growth delta (not proportional)
  - H-Model gS = 3-year average growth
  - EPS CAGR filters to positive values only

---

## DRIVER Methodology

This project was built following the **DRIVER** framework for AI-assisted development:

| Stage | What Happened |
|---|---|
| **Define** | Researched CFA valuation standards, SEC EDGAR XBRL taxonomy, existing tools |
| **Represent** | Planned 14-model architecture, data pipeline, component structure |
| **Implement** | Built iteratively — data layer → calculations → UI → quality scores |
| **Validate** | 77 unit tests, CI pipeline, CFA L3 analytical review |
| **Evolve** | Instructor feedback → peer comps, D&A fix, SOTP docs, CHANGELOG |
| **Reflect** | 16 additional CFA fixes applied post-review |

---

## AI Log

AI tools used: **Claude (Anthropic)** for code generation and architecture.

### Development Sessions

**Session 1 — Foundation**
- Prompt: Build a Next.js valuation app with SEC EDGAR data pipeline
- Output: Basic FCFF DCF with XBRL fetcher
- Human modification: Added CAPM-derived WACC, adjusted fallback logic

**Session 2 — 14 Models**
- Prompt: Add CFA L2/L3 models — FCFE, RI, DDM, H-Model, multiples, justified ratios
- Output: `calculations.ts` with pure functions, Monte Carlo, Reverse DCF
- Human modification: Verified CFA formula correctness against textbook, added test suite

**Session 3 — Data Quality**
- Prompt: Fix D&A double-counting, add live peer comps, SOTP guidance
- Output: `peerFetcher.ts` with 11-sector GICS map, per-year D&A arrays
- Human modification: Tuned sector peer lists, verified XBRL concept fallbacks

**Session 4 — CFA L3 Review**
- Prompt: Fix 16 analytical issues identified in CFA review
- Output: ΔNWC in FCFF, ke consistency in DDM, NTM EPS for P/E/PEG, additive MC growth
- Human modification: Reviewed each fix against CFA standards before accepting

**Session 5 — Quality & CI**
- Prompt: Add Beneish M-Score, GitHub Actions CI/CD pipeline
- Output: `computeBeneish()` function, `.github/workflows/ci.yml`
- Human modification: Reviewed data availability constraints, added Est. disclosures

### Key Human Decisions
- Chose SEC EDGAR XBRL over Yahoo Finance for fundamentals (reliability)
- Decided against hardcoded peer lists — required live fetching
- Rejected proportional MC growth scaling in favor of additive delta
- Chose to disclose data limitations (Est. labels) rather than hide them

---

## Project Structure

```
valuation_web/
├── app/
│   ├── [ticker]/page.tsx        # Server component — fetches data
│   └── api/
│       ├── ask/route.ts         # GPT-4o-mini Ask AI endpoint
│       └── data/[ticker]/       # Data API
├── components/valuation/
│   ├── tabs/models/             # DCF, DDM, RI, SOTP, Football Field...
│   ├── tabs/QualityScoresTab.tsx # Piotroski, Altman Z, Beneish M, DuPont
│   └── AssumptionsDrawer.tsx    # Live scenario controls
├── lib/valuation/
│   ├── calculations.ts          # Pure valuation functions (tested)
│   ├── edgarXbrl.ts             # SEC EDGAR XBRL pipeline
│   ├── peerFetcher.ts           # Live sector peer comps
│   └── presets.ts               # Base/Bull/Bear scenario defaults
├── __tests__/                   # 77 unit tests
├── .github/workflows/ci.yml     # GitHub Actions CI/CD
└── CHANGELOG.md                 # Staged development history
```

---

## Running Locally

```bash
git clone https://github.com/Abrahamgeorge97/msf-ai-finance.git
cd msf-ai-finance
npm install
# Add your API keys to .env.local (see .env.example)
npm run dev     # http://localhost:3000
npm run test    # Run 77 unit tests
npm run build   # Production build + TypeScript check
```

**Required environment variables:**
```
OPENAI_API_KEY=your_key_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> Never commit API keys. `.env.local` is gitignored.

---

## Author

**Abraham Tomy** — MSF Student  
[Substack](https://substack.com/home/post/p-189725846) · [Live App](https://valuationweb.vercel.app)
