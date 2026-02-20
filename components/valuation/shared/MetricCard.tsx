import { cn } from "@/lib/utils"

interface Props {
  label: string
  value: string
  delta?: string
  deltaPositive?: boolean
  className?: string
}

export function MetricCard({ label, value, delta, deltaPositive, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-foreground">{value}</p>
      {delta && (
        <p className={cn("mt-0.5 text-xs font-medium", deltaPositive ? "text-buy" : "text-sell")}>
          {delta}
        </p>
      )}
    </div>
  )
}
