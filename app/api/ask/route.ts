import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 60

// ── System prompt (static — cached by Claude's prompt caching) ────────────────

const SYSTEM_PROMPT = `You are an expert financial analyst assistant embedded in the MSF AI Finance Equity Valuation Terminal.
You help users understand valuation models, financial assumptions, and how to interpret outputs.
Be concise, precise, and always reference actual numbers from the company context when answering.
When relevant, you can cross-check or supplement data using web search.

## Platform Overview
The terminal fetches live financial data from SEC EDGAR (XBRL 10-K filings) and Yahoo Finance,
then runs 14 institutional-grade valuation methods to produce a consensus Buy / Hold / Sell signal.

---

## The 14 Valuation Methods

### 1. FCFF (DCF) — Free Cash Flow to Firm
- Projects free cash flows using the pro-forma income statement, then discounts at WACC.
- Terminal value = blend of (a) perpetuity growth model and (b) exit EV/EBITDA multiple.
- FCFF = EBIT × (1 − Tax Rate) + D&A − CapEx
- Key inputs: WACC, terminal growth rate, projection period, CapEx % Revenue.
- Intrinsic value formula: PV(FCFFs) + PV(Terminal Value) − Net Debt, divided by shares.

### 2. FCFE — Free Cash Flow to Equity (CFA Level 2)
- FCFE = FCFF − Interest × (1 − Tax Rate) + Net Borrowing
- Discounted at the Cost of Equity (Ke) rather than WACC.
- More appropriate for levered firms where capital structure matters.
- Key inputs: Cost of Equity, net borrowing, interest expense.

### 3. Residual Income (CFA Level 2)
- RI_t = EPS_t − Ke × BVPS_{t−1}   (economic profit above required return)
- V₀ = BVPS₀ + Σ PV(RI_t) + PV(Terminal RI)
- Based on clean surplus relation: BVPS grows by retained earnings each period.
- Anchored to book value — useful when cash flows are negative.

### 4. DDM — Dividend Discount Model (2-Stage + H-Model)
- 2-Stage: Discounts explicit dividends over projection period at Ke, then Gordon Growth terminal value.
- H-Model: P₀ = D₀(1+gL)/(r−gL) + D₀×H×(gS−gL)/(r−gL)  where H = half-life of high-growth period.
- Returns N/A for non-dividend-paying companies.
- Key inputs: Cost of Equity, terminal growth rate, DPS, H half-life.

### 5. EBITDA Multiple Valuation
- Applies the median peer EV/EBITDA multiple to the company's projected EBITDA.
- Enterprise Value = Projected EBITDA × Median Peer Multiple.
- Bridges to equity: (EV − Net Debt) / Shares Diluted.
- Key inputs: Target EBITDA margin, growth rates, comparable company EV/EBITDA multiples.

### 6. Revenue Multiple Valuation
- Applies the median peer EV/Revenue multiple to projected revenue.
- Useful for early-stage or low-margin businesses.
- Key inputs: Year 1–3 growth rates, long-term growth, peer EV/Revenue multiples.

### 7. P/E Multiple Valuation
- Applies the median peer P/E ratio to the company's adjusted EPS.
- Price Target = Median Peer P/E × Adj. EPS.
- Key inputs: Peer P/E ratios, company adjusted EPS.

### 8. Justified P/E (CFA Level 2)
- Justified P/E = (1 − b) / (r − g)  where b = plowback ratio, r = cost of equity, g = ROE × b.
- Represents the theoretically correct P/E given a company's fundamentals.
- Compare to current market P/E to assess over/undervaluation.

### 9. PEG Ratio
- Fair value P/E = PEG × EPS Growth Rate. Applied to EPS for price target.
- Penalises high-P/E stocks with low growth and rewards low-P/E stocks with high growth.
- Key inputs: Peer PEG ratio, EPS growth rate, adjusted EPS.

### 10. P/B — Price-to-Book
- Applies the median peer P/B multiple to book value per share.
- Price Target = Median Peer P/B × Book Value per Share.
- Key inputs: Peer P/B multiples, net book value, shares outstanding.

### 11. Justified P/B (CFA Level 2)
- Justified P/B = (ROE − g) / (r − g)
- A P/B > Justified P/B implies the stock is overvalued relative to its return on equity.
- Directly links price-to-book to profitability metrics.

### 12. P/CF — Price-to-Cash Flow
- CFO per Share = Operating Cash Flow / Shares Diluted.
- Price Target = Median Peer P/CF × CFO per Share.
- Less susceptible to accrual accounting manipulation than P/E.

### 13. SOTP — Sum-of-the-Parts
- Values each reported business segment individually using segment-appropriate multiples.
- Aggregates segment values to total enterprise value, then bridges to equity.
- Best for diversified companies with distinct segments.

### 14. Football Field Chart
- Horizontal bar chart showing all model outputs vs. the current market price.
- Weighted consensus: FCFF 20%, FCFE 10%, RI 10%, EBITDA 12%, P/E 8%, Justified P/E 7%,
  Justified P/B 5%, P/CF 7%, DDM 3%, H-Model 2%, PEG 3%, P/B 3%, Revenue 5%, SOTP 5%.

---

## Key Assumptions Explained

| Assumption | Definition | Typical Range | Impact |
|---|---|---|---|
| WACC | Weighted Average Cost of Capital | 6–12% | Higher WACC → lower DCF value |
| Cost of Equity (Ke) | Required return on equity (CAPM: Rf + β × ERP) | 7–14% | DDM, FCFE, RI discount rate |
| Risk-Free Rate (Rf) | 10-year US Treasury yield | 3–5% | Base of CAPM |
| Equity Risk Premium (ERP) | Expected excess return of equities over Rf | 4–6% | CAPM multiplier |
| Beta (β) | Systematic risk vs market | 0.5–2.0 | Cost of equity |
| Year 1–3 Growth | Explicit annual revenue growth rates | −5% to +15% | Near-term cash flows |
| Long-term Growth | Revenue growth rate after Year 3 (linear fade) | 1–6% | Mid-term trajectory |
| Terminal Growth Rate | Perpetuity growth in DCF terminal value | 1–4% | Must be < WACC |
| Target EBITDA Margin | Margin level at end of projection period | 10–45% | Profitability trajectory |
| CapEx % Revenue | Capital expenditure intensity | 0.5–8% | Free cash flow headroom |
| Exit EV/EBITDA | Multiple for DCF exit-multiple terminal value | 6–30× | Blends with perpetuity TV |
| Projection Period | Years of explicit forecasting | 3–10 yrs | Terminal value weighting |

---

## Buy / Hold / Sell Signal System
- **BUY**: Model price target > 15% above current market price.
- **HOLD**: Model price target within ±15% of current market price.
- **SELL**: Model price target > 15% below current market price.
- **Consensus**: Weighted average across all active models. Models outputting zero are excluded.

---

## Data Sources & Accuracy
- **Fundamentals**: SEC EDGAR XBRL API (10-K filings) — D&A, CapEx, equity, OCF, all balance sheet items.
- **Market data**: Yahoo Finance — live price, beta, market cap.
- **CAPM inputs**: Risk-free rate, ERP, and cost of debt are user-adjustable in the Assumptions drawer.
- **D&A fallback**: If XBRL has no D&A concept, falls back to 3% of revenue (may understate for capital-intensive industries).
- **CapEx fallback**: If XBRL has no CapEx concept, falls back to 2.5% of revenue.
- **Data age**: Based on most recent 10-K filing — may be 6–18 months old depending on fiscal year.

When users ask about data accuracy, use web search to cross-check key metrics against current sources.

Answer concisely and precisely. Use numbers from the company context when relevant.
If asked about a specific model, explain how it works and what the current inputs imply.`

// ── Company context builder ───────────────────────────────────────────────────

function buildContext(config: Record<string, unknown>, assumptions: Record<string, unknown>): string {
  const B = (config.baseline ?? {}) as Record<string, number>
  const comps = (config.comps ?? {}) as Record<string, Record<string, number>>

  const compsText = Object.entries(comps)
    .map(([name, m]) =>
      `- ${name}: EV/EBITDA ${m.ev_ebitda ?? "?"}×, EV/Rev ${m.ev_rev ?? "?"}×, P/E ${m.pe ?? "?"}×, P/CF ${m.pcf ?? "?"}×`
    )
    .join("\n")

  const a = assumptions as Record<string, number | string>

  return `
---
## Current Company in View: ${config.name} (${config.exchange}: ${config.ticker})

### Baseline Financials (most recent fiscal year, $M unless stated)
| Metric | Value |
|--------|-------|
| Revenue | $${(B.revenue ?? 0).toLocaleString()}M |
| EBITDA | $${(B.ebitda ?? 0).toLocaleString()}M |
| EBITDA Margin | ${((B.ebitda_margin ?? 0) * 100).toFixed(1)}% |
| Net Income | $${(B.net_income ?? 0).toLocaleString()}M |
| FCF | $${(B.fcf ?? 0).toLocaleString()}M |
| OCF | $${(B.ocf ?? 0).toLocaleString()}M |
| CapEx | $${(B.capex ?? 0).toLocaleString()}M |
| Adj. EPS | $${(B.adj_eps ?? 0).toFixed(2)} |
| DPS | $${(B.dps ?? 0).toFixed(2)} |
| BVPS | $${(B.bvps ?? 0).toFixed(2)} |
| Current Price | $${(B.current_price ?? 0).toFixed(2)} |
| Shares Diluted | ${(B.shares_diluted ?? 0).toFixed(1)}M |
| Net Debt | $${(B.net_debt ?? 0).toLocaleString()}M |
| ROE | ${((B.roe ?? 0) * 100).toFixed(1)}% |
| Tax Rate | ${((B.tax_rate ?? 0) * 100).toFixed(1)}% |
| D&A Total | $${(B.da_total ?? 0).toLocaleString()}M |

${compsText ? `### Peer Comparables\n${compsText}` : ""}

### Active Assumption Values
| Assumption | Value |
|------------|-------|
| Scenario | ${a.scenario} |
| WACC | ${((a.wacc as number ?? 0) * 100).toFixed(2)}% |
| Cost of Equity (Ke) | ${((a.cost_of_equity as number ?? 0) * 100).toFixed(2)}% |
| Risk-Free Rate | ${((a.rf as number ?? 0) * 100).toFixed(2)}% |
| ERP | ${((a.erp as number ?? 0) * 100).toFixed(2)}% |
| Beta | ${(a.beta as number ?? 0).toFixed(2)} |
| Year 1 Revenue Growth | ${((a.yr1_g as number ?? 0) * 100).toFixed(1)}% |
| Year 2 Revenue Growth | ${((a.yr2_g as number ?? 0) * 100).toFixed(1)}% |
| Year 3 Revenue Growth | ${((a.yr3_g as number ?? 0) * 100).toFixed(1)}% |
| Long-term Growth | ${((a.lt_g as number ?? 0) * 100).toFixed(1)}% |
| Terminal Growth Rate | ${((a.terminal_g as number ?? 0) * 100).toFixed(2)}% |
| Target EBITDA Margin | ${((a.target_ebitda_m as number ?? 0) * 100).toFixed(1)}% |
| CapEx % Revenue | ${((a.capex_pct as number ?? 0) * 100).toFixed(2)}% |
| Exit EV/EBITDA Multiple | ${(a.exit_mult as number ?? 0).toFixed(1)}× |
| Projection Period | ${a.proj_years_n} years |
---`
}

// ── API route (streaming with Claude + web search for cross-checking) ──────────

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const { messages, config, assumptions } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    const body = encoder.encode(
      "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env.local file."
    )
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }

  const client = new Anthropic({ apiKey })
  const contextBlock = buildContext(config, assumptions)

  try {
    // Stream with prompt caching on the system prompt (reduces cost ~90% on repeated queries)
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          // Stable base prompt — cached across all queries to this endpoint
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          // Per-company context — cached per ticker session
          text: contextBlock,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        // Web search: Claude can cross-check data against live sources
        { type: "web_search_20260209", name: "web_search" },
      ],
      messages: (messages as { role: string; content: string }[])
        .slice(-12)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    })

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            // Stream text deltas — these come through whether Claude answered
            // directly or used web search first (server-side tool, no client loop needed)
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          // If web_search tool fails (e.g. not available on this tier),
          // fall back to the final message text only
          try {
            const finalMsg = await stream.finalMessage()
            const text = finalMsg.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("")
            if (text) controller.enqueue(encoder.encode(text))
          } catch {
            controller.enqueue(
              encoder.encode(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
            )
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return new Response(encoder.encode(`Error: ${msg}`), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
