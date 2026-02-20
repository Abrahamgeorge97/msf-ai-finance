/**
 * Unit tests for lib/valuation/newsFetcher.ts
 *
 * Coverage:
 *   categorize — all 7 keyword categories + General fallback
 *   sentiment  — Positive, Negative, Neutral, tie-break, case-insensitive
 *
 * Mirrors TestCategorize + TestSentiment from
 * valuation_platform/tests/test_data_pipeline.py
 */

import { describe, it, expect } from "vitest"
import { categorize, sentiment } from "@/lib/valuation/newsFetcher"

// ── categorize ─────────────────────────────────────────────────────────────────

describe("categorize", () => {
  it("returns Earnings for earnings keyword", () => {
    expect(categorize("Company reports quarterly earnings beat")).toBe("Earnings")
  })

  it("returns Earnings for EPS keyword", () => {
    expect(categorize("Analyst raises EPS estimate for Q3")).toBe("Earnings")
  })

  it("returns Guidance for guidance keyword", () => {
    expect(categorize("Company raises full-year guidance for revenue")).toBe("Guidance")
  })

  it("returns Guidance for outlook keyword", () => {
    expect(categorize("Management provides cautious outlook for next quarter")).toBe("Guidance")
  })

  it("returns M&A for acquisition keyword", () => {
    expect(categorize("Company announces acquisition of rival firm")).toBe("M&A")
  })

  it("returns M&A for merger keyword", () => {
    expect(categorize("Merger agreement signed between two tech giants")).toBe("M&A")
  })

  it("returns Regulation for FDA keyword", () => {
    expect(categorize("FDA approves new drug application")).toBe("Regulation")
  })

  it("returns Regulation for SEC keyword", () => {
    expect(categorize("SEC launches investigation into accounting practices")).toBe("Regulation")
  })

  it("returns Product Strategy for launch keyword", () => {
    expect(categorize("Company launches new product line ahead of schedule")).toBe("Product Strategy")
  })

  it("returns Litigation for lawsuit keyword", () => {
    expect(categorize("Company faces new lawsuit over patent infringement")).toBe("Litigation")
  })

  it("returns Litigation for verdict keyword", () => {
    expect(categorize("Jury delivers verdict in shareholder dispute")).toBe("Litigation")
  })

  it("returns Macro Exposure for tariff keyword", () => {
    expect(categorize("GDP growth slows amid trade war tariff concerns")).toBe("Macro Exposure")
  })

  it("returns Macro Exposure for inflation keyword", () => {
    expect(categorize("Inflation rises sharply, Fed signals rate hike")).toBe("Macro Exposure")
  })

  it("returns General for unmatched text", () => {
    expect(categorize("Company hires new CFO from Goldman Sachs")).toBe("General")
  })

  it("returns General for empty string", () => {
    expect(categorize("")).toBe("General")
  })

  it("is case-insensitive", () => {
    expect(categorize("EARNINGS BEAT THIS QUARTER")).toBe("Earnings")
  })
})

// ── sentiment ──────────────────────────────────────────────────────────────────

describe("sentiment", () => {
  it("returns Positive when positive keywords dominate", () => {
    expect(sentiment("Company beats estimates with record profit")).toBe("Positive")
  })

  it("returns Positive for strong/growth/surge keywords", () => {
    expect(sentiment("Strong revenue growth surges past expectations")).toBe("Positive")
  })

  it("returns Negative when negative keywords dominate", () => {
    expect(sentiment("Company misses targets, stock falls on weak outlook")).toBe("Negative")
  })

  it("returns Negative for decline/cut/warning keywords", () => {
    expect(sentiment("Revenue declines sharply, company cuts guidance with warning")).toBe("Negative")
  })

  it("returns Neutral when no keywords match", () => {
    expect(sentiment("Company announces CFO transition effective next quarter")).toBe("Neutral")
  })

  it("returns Neutral when positive and negative counts are equal (tie-break)", () => {
    // "beat" = +1, "miss" = -1 → tie → Neutral
    expect(sentiment("beat miss")).toBe("Neutral")
  })

  it("returns Positive when multiple positives outweigh single negative", () => {
    expect(sentiment("strong growth record gain boost")).toBe("Positive")
  })

  it("returns Negative when multiple negatives outweigh positives", () => {
    expect(sentiment("miss decline cut warning loss")).toBe("Negative")
  })

  it("returns Neutral for empty string", () => {
    expect(sentiment("")).toBe("Neutral")
  })

  it("is case-insensitive", () => {
    expect(sentiment("STRONG RECORD BEAT")).toBe("Positive")
  })
})
