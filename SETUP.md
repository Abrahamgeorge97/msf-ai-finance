# Setup

## 1. Install Node.js
Download from https://nodejs.org (v20 LTS recommended).

## 2. Install dependencies
```bash
cd valuation_web
npm install
```

## 3. Run dev server
```bash
npm run dev
# → http://localhost:3000
```

## 4. Add company data
Place JSON files in `public/data/`:
```
public/
  data/
    AAPL.json
    MSFT.json
```
Each file: `{ "config": { ...ValuationConfig }, "news": [...] }`

Without a data file, the app renders mock data so the UI is always visible.

## 5. OpenAI key
Already set in `.env.local`. Regenerate if needed (key was shared in chat).

## Project Structure
```
app/
  [ticker]/page.tsx       → Server component, fetches data
  api/ask/route.ts        → OpenAI API route
  layout.tsx / globals.css
components/valuation/
  ValuationDashboard.tsx  → Root client component
  AssumptionsSidebar.tsx  → Assumptions sliders
  tabs/
    OverviewTab.tsx        → KPIs, signals, charts
    ValuationModelsTab.tsx → Core / Multiples / Advanced
    NewsTab.tsx
    AskAITab.tsx
    models/
      DCFTab.tsx           → Full DCF with sensitivity
      FootballFieldTab.tsx → Football field chart
      (add more models here following same pattern)
lib/valuation/
  calculations.ts          → computeAll(), dcfPrice(), buildProforma()
  presets.ts               → SCENARIO_PRESETS, CHART_COLORS
  dataFetcher.ts           → fetchConfig() — swap for real data
types/valuation.ts         → All TypeScript interfaces
```
