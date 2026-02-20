/**
 * Unit tests for lib/valuation/edgarXbrl.ts
 *
 * Coverage:
 *   pickAnnual   — form filtering, duration filtering, deduplication, sorting
 *   firstConcept — primary concept, fallback, missing concepts, empty gaap
 *
 * Mirrors the _extract_fact / _get_available_fiscal_years tests
 * from valuation_platform/tests/test_data_pipeline.py
 */

import { describe, it, expect } from "vitest"
import { pickAnnual, firstConcept, XbrlUnit } from "@/lib/valuation/edgarXbrl"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Build a minimal annual XbrlUnit (10-K, ~365-day duration). */
function annualEntry(
  val: number,
  year: number,
  opts: { form?: string; filed?: string } = {},
): XbrlUnit {
  return {
    val,
    start: `${year}-01-01`,
    end:   `${year}-12-31`,
    form:  opts.form  ?? "10-K",
    filed: opts.filed ?? `${year + 1}-02-15`,
    accn: `000123456${year}`,
    cik: 12345,
    entityName: "Test Corp",
    loc: "US-DE",
  }
}

/** Build a quarterly entry (10-Q, ~90-day duration). */
function quarterlyEntry(val: number, year: number, quarter: 1 | 2 | 3): XbrlUnit {
  const quarters: Record<number, { start: string; end: string }> = {
    1: { start: `${year}-01-01`, end: `${year}-03-31` },
    2: { start: `${year}-04-01`, end: `${year}-06-30` },
    3: { start: `${year}-07-01`, end: `${year}-09-30` },
  }
  return {
    val,
    start: quarters[quarter].start,
    end:   quarters[quarter].end,
    form:  "10-Q",
    filed: `${year}-11-01`,
    accn: `000123456Q${year}`,
    cik: 12345,
    entityName: "Test Corp",
    loc: "US-DE",
  }
}

/** Build a minimal XbrlConcept with annual entries. */
function makeConcept(entries: XbrlUnit[], unit = "USD") {
  return { label: "Test", description: "Test", units: { [unit]: entries } }
}

// ── pickAnnual ─────────────────────────────────────────────────────────────────

describe("pickAnnual", () => {
  it("returns annual 10-K entries", () => {
    const entries = [annualEntry(1_000_000, 2023)]
    const result = pickAnnual(entries)
    expect(result).toHaveLength(1)
    expect(result[0].val).toBe(1_000_000)
  })

  it("filters out 10-Q quarterly entries", () => {
    const entries = [
      quarterlyEntry(250_000, 2023, 3),
      annualEntry(1_000_000, 2023),
    ]
    const result = pickAnnual(entries)
    expect(result).toHaveLength(1)
    expect(result[0].val).toBe(1_000_000)
  })

  it("filters out entries missing start date", () => {
    const entry: XbrlUnit = {
      val: 500_000, end: "2023-12-31", form: "10-K",
      accn: "", cik: 0, entityName: "", loc: "",
    }
    const result = pickAnnual([entry])
    expect(result).toHaveLength(0)
  })

  it("filters out entries with duration under 300 days", () => {
    const shortEntry: XbrlUnit = {
      val: 500_000,
      start: "2023-07-01",
      end:   "2023-12-31",   // ~183 days
      form:  "10-K",
      accn: "", cik: 0, entityName: "", loc: "",
    }
    expect(pickAnnual([shortEntry])).toHaveLength(0)
  })

  it("filters out entries with duration over 400 days", () => {
    const longEntry: XbrlUnit = {
      val: 500_000,
      start: "2022-01-01",
      end:   "2023-12-31",   // ~730 days
      form:  "10-K",
      accn: "", cik: 0, entityName: "", loc: "",
    }
    expect(pickAnnual([longEntry])).toHaveLength(0)
  })

  it("accepts 10-K/A amended filings", () => {
    const entry = { ...annualEntry(1_000_000, 2023), form: "10-K/A" }
    expect(pickAnnual([entry])).toHaveLength(1)
  })

  it("accepts 20-F foreign annual filings", () => {
    const entry = { ...annualEntry(1_000_000, 2023), form: "20-F" }
    expect(pickAnnual([entry])).toHaveLength(1)
  })

  it("deduplicates same fiscal year-end keeping latest filed", () => {
    const older = { ...annualEntry(900_000, 2023), filed: "2024-01-15" }
    const newer = { ...annualEntry(1_000_000, 2023), filed: "2024-02-28" }
    const result = pickAnnual([older, newer])
    expect(result).toHaveLength(1)
    expect(result[0].val).toBe(1_000_000)
  })

  it("returns multiple years sorted by end date ascending", () => {
    const entries = [
      annualEntry(1_200_000, 2023),
      annualEntry(1_000_000, 2021),
      annualEntry(1_100_000, 2022),
    ]
    const result = pickAnnual(entries)
    expect(result.map((r) => r.val)).toEqual([1_000_000, 1_100_000, 1_200_000])
  })

  it("returns empty array for empty input", () => {
    expect(pickAnnual([])).toHaveLength(0)
  })

  it("returns empty array when only 10-Q entries exist", () => {
    const entries = [quarterlyEntry(250_000, 2023, 1), quarterlyEntry(260_000, 2023, 2)]
    expect(pickAnnual(entries)).toHaveLength(0)
  })
})

// ── firstConcept ───────────────────────────────────────────────────────────────

describe("firstConcept", () => {
  it("returns entries for the first matching concept", () => {
    const gaap = {
      Revenues: makeConcept([annualEntry(3_000_000, 2023)]),
    }
    const result = firstConcept(gaap, ["Revenues"])
    expect(result).toHaveLength(1)
    expect(result[0].val).toBe(3_000_000)
  })

  it("falls back to the second concept when first is absent", () => {
    const gaap = {
      Revenues: makeConcept([annualEntry(2_000_000, 2023)]),
    }
    const result = firstConcept(gaap, ["NonExistentConcept", "Revenues"])
    expect(result).toHaveLength(1)
    expect(result[0].val).toBe(2_000_000)
  })

  it("returns empty array when no concept matches", () => {
    const gaap = {
      Revenues: makeConcept([annualEntry(1_000_000, 2023)]),
    }
    const result = firstConcept(gaap, ["MissingA", "MissingB"])
    expect(result).toHaveLength(0)
  })

  it("returns empty array for empty gaap object", () => {
    expect(firstConcept({}, ["Revenues"])).toHaveLength(0)
  })

  it("skips a concept whose unit array is empty", () => {
    const gaap = {
      RevenueEmpty: { label: "", description: "", units: { USD: [] } },
      Revenues:     makeConcept([annualEntry(1_500_000, 2023)]),
    }
    const result = firstConcept(gaap, ["RevenueEmpty", "Revenues"])
    expect(result[0].val).toBe(1_500_000)
  })

  it("uses the correct unit key (shares)", () => {
    const gaap = {
      WeightedAverageNumberOfDilutedSharesOutstanding: makeConcept(
        [annualEntry(88_000_000, 2023)],
        "shares",
      ),
    }
    const result = firstConcept(gaap, ["WeightedAverageNumberOfDilutedSharesOutstanding"], "shares")
    expect(result[0].val).toBe(88_000_000)
  })

  it("uses the correct unit key (USD/shares for EPS)", () => {
    const gaap = {
      EarningsPerShareDiluted: makeConcept(
        [annualEntry(5.85, 2023)],
        "USD/shares",
      ),
    }
    const result = firstConcept(gaap, ["EarningsPerShareDiluted"], "USD/shares")
    expect(result[0].val).toBeCloseTo(5.85)
  })

  it("returns multiple years in order", () => {
    const gaap = {
      Revenues: makeConcept([
        annualEntry(3_000_000, 2021),
        annualEntry(3_300_000, 2022),
        annualEntry(3_600_000, 2023),
      ]),
    }
    const result = firstConcept(gaap, ["Revenues"])
    expect(result).toHaveLength(3)
    expect(result[2].val).toBe(3_600_000) // newest last
  })

  it("skips a concept that has no annual entries (only quarterly)", () => {
    const gaap = {
      RevenueQuarterlyOnly: makeConcept([quarterlyEntry(800_000, 2023, 3)]),
      Revenues: makeConcept([annualEntry(3_200_000, 2023)]),
    }
    const result = firstConcept(gaap, ["RevenueQuarterlyOnly", "Revenues"])
    expect(result[0].val).toBe(3_200_000)
  })
})
