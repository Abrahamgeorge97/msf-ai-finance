"use client"

import { DCFTab } from "./models/DCFTab"
import { FCFETab } from "./models/FCFETab"
import { ResidualIncomeTab } from "./models/ResidualIncomeTab"
import { DDMTab } from "./models/DDMTab"
import { FootballFieldTab } from "./models/FootballFieldTab"
import { PETab } from "./models/PETab"
import { EVEBITDATab } from "./models/EVEBITDATab"
import { PEGTab } from "./models/PEGTab"
import { PBTab } from "./models/PBTab"
import { RevenueTab } from "./models/RevenueTab"
import { PCFTab } from "./models/PCFTab"
import { MonteCarloTab } from "./models/MonteCarloTab"
import { ReverseDCFTab } from "./models/ReverseDCFTab"
import { ScenarioTab } from "./models/ScenarioTab"
import { SOTPTab } from "./models/SOTPTab"
import type { ValuationConfig, Assumptions } from "@/types/valuation"
import type { ComputedValuations, MonteCarloResults } from "@/lib/valuation/calculations"
import { cn } from "@/lib/utils"
import { useState } from "react"

// ── Sub-tab primitives ────────────────────────────────────────────
function TabGroup({
  tabs,
  children,
  stickyTop = "top-[41px]",
}: {
  tabs: string[]
  children: (activeIdx: number) => React.ReactNode
  stickyTop?: string
}) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className={cn("sticky z-10 flex gap-1 border-b border-border px-4 pt-3 pb-0 overflow-x-auto bg-background", stickyTop)}>
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className={cn(
              "whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              active === i
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  )
}

// Placeholder for tabs not yet implemented
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground">
      <p className="text-sm">{name} — coming soon</p>
    </div>
  )
}

// ── Category tabs ─────────────────────────────────────────────────
const CATEGORY_TABS = ["Core", "Multiples", "Advanced"] as const
type Category = (typeof CATEGORY_TABS)[number]

const CORE_TABS      = ["DCF (FCFF)", "FCFE", "Residual Income", "DDM", "Reverse DCF"]
const MULTIPLES_TABS = ["P/E", "EV/EBITDA", "PEG", "P/B", "Revenue", "P/CF"]
const ADVANCED_TABS  = ["Monte Carlo", "SOTP", "Football Field", "Scenario"]

interface Props {
  config: ValuationConfig
  computed: ComputedValuations
  assumptions: Assumptions
  mcResults?: Record<string, number[]>
  onMcComplete?: (results: MonteCarloResults) => void
}

export function ValuationModelsTab({ config, computed, assumptions, mcResults, onMcComplete }: Props) {
  const [category, setCategory] = useState<Category>("Core")

  return (
    <div>
      {/* Category selector — sticky just below the header */}
      <div className="sticky top-0 z-20 flex gap-2 px-4 pt-4 pb-3 border-b border-border bg-background">
        {CATEGORY_TABS.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              category === c
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Core */}
      {category === "Core" && (
        <TabGroup tabs={CORE_TABS} stickyTop="top-[41px]">
          {(i) => (
            <>
              {i === 0 && <DCFTab config={config} computed={computed} />}
              {i === 1 && <FCFETab config={config} computed={computed} />}
              {i === 2 && <ResidualIncomeTab config={config} computed={computed} />}
              {i === 3 && <DDMTab config={config} computed={computed} />}
              {i === 4 && <ReverseDCFTab config={config} computed={computed} />}
            </>
          )}
        </TabGroup>
      )}

      {/* Multiples */}
      {category === "Multiples" && (
        <TabGroup tabs={MULTIPLES_TABS} stickyTop="top-[41px]">
          {(i) => (
            <>
              {i === 0 && <PETab config={config} computed={computed} />}
              {i === 1 && <EVEBITDATab config={config} computed={computed} />}
              {i === 2 && <PEGTab config={config} computed={computed} />}
              {i === 3 && <PBTab config={config} computed={computed} />}
              {i === 4 && <RevenueTab config={config} computed={computed} />}
              {i === 5 && <PCFTab config={config} computed={computed} />}
            </>
          )}
        </TabGroup>
      )}

      {/* Advanced */}
      {category === "Advanced" && (
        <TabGroup tabs={ADVANCED_TABS} stickyTop="top-[41px]">
          {(i) => (
            <>
              {i === 0 && <MonteCarloTab config={config} computed={computed} onComplete={onMcComplete} />}
              {i === 1 && <SOTPTab config={config} computed={computed} />}
              {i === 2 && <FootballFieldTab config={config} computed={computed} mcResults={mcResults} />}
              {i === 3 && <ScenarioTab config={config} computed={computed} />}
            </>
          )}
        </TabGroup>
      )}
    </div>
  )
}
