import type { Signal } from "@/types/valuation"
import { cn } from "@/lib/utils"

const CONFIG: Record<Signal, { label: string; className: string }> = {
  BUY: { label: "BUY", className: "bg-buy/15 text-buy border-buy/30" },
  HOLD: { label: "HOLD", className: "bg-hold/15 text-hold border-hold/30" },
  SELL: { label: "SELL", className: "bg-sell/15 text-sell border-sell/30" },
  "N/A": { label: "N/A", className: "bg-muted text-muted-foreground border-border" },
}

interface Props {
  signal: Signal
  size?: "sm" | "md" | "lg"
}

export function SignalBadge({ signal, size = "md" }: Props) {
  const { label, className } = CONFIG[signal]
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-semibold tracking-wider uppercase",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-3 py-1",
        size === "lg" && "text-2xl px-8 py-3 font-bold",
        className,
      )}
    >
      {label}
    </span>
  )
}

export function ConsensusSignal({
  signal,
  buys,
  holds,
  sells,
  currentPrice,
}: {
  signal: Signal
  buys: number
  holds: number
  sells: number
  currentPrice: number
}) {
  const borderColor = { BUY: "#22c55e", HOLD: "#f59e0b", SELL: "#ef4444", "N/A": "#64748b" }[signal]

  return (
    <div
      className="rounded-xl border-2 p-6 text-center"
      style={{ borderColor, background: `${borderColor}11` }}
    >
      <SignalBadge signal={signal} size="lg" />
      <p className="mt-2 text-sm text-muted-foreground">
        Consensus: {buys} BUY · {holds} HOLD · {sells} SELL &nbsp;|&nbsp; Current{" "}
        <span className="font-mono font-semibold text-foreground">${currentPrice.toLocaleString()}</span>
      </p>
    </div>
  )
}
