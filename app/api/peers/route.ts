import { NextRequest, NextResponse } from "next/server"
import { fetchPeerComps } from "@/lib/valuation/peerFetcher"

/**
 * GET /api/peers?tickers=MSFT,GOOGL,META
 * Returns live multiples for the supplied comma-separated tickers.
 * Used by the manual peer override UI in ValuationDashboard.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") ?? ""
  const custom = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6)

  if (custom.length === 0) {
    return NextResponse.json({ error: "Provide tickers as ?tickers=AAPL,MSFT" }, { status: 400 })
  }

  try {
    const comps = await fetchPeerComps("", "", custom)
    return NextResponse.json(
      { comps },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" } },
    )
  } catch (err) {
    console.error("[/api/peers]", err)
    return NextResponse.json({ error: "Failed to fetch peer data" }, { status: 500 })
  }
}
