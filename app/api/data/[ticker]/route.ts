import { NextRequest, NextResponse } from "next/server"
import { fetchLiveConfig } from "@/lib/valuation/yahooFetcher"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params

  try {
    const result = await fetchLiveConfig(ticker)
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
    })
  } catch (err) {
    console.error(`[/api/data/${ticker}]`, err)
    return NextResponse.json(
      { error: `Could not fetch data for ${ticker.toUpperCase()}` },
      { status: 500 }
    )
  }
}
