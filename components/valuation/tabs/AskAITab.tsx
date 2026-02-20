"use client"

import type { ValuationConfig, Assumptions } from "@/types/valuation"
import { FinanceTerminal } from "../FinanceTerminal"

interface Props {
  config: ValuationConfig
  assumptions: Assumptions
}

export function AskAITab({ config, assumptions }: Props) {
  return (
    <div className="h-full p-4">
      <FinanceTerminal config={config} assumptions={assumptions} className="h-full" />
    </div>
  )
}
