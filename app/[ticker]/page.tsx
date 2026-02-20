import { fetchConfig } from "@/lib/valuation/dataFetcher"
import { notFound } from "next/navigation"
import { TickerPageClient } from "./TickerPageClient"

interface Props {
  params: Promise<{ ticker: string }>
}

export default async function TickerPage({ params }: Props) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const { config, news, sec } = await fetchConfig(upper)
  if (!config) notFound()

  return <TickerPageClient ticker={upper} serverConfig={config} news={news} sec={sec} />
}

export async function generateMetadata({ params }: Props) {
  const { ticker } = await params
  return { title: `${ticker.toUpperCase()} — MSF Valuation Terminal` }
}
