import { cn } from "@/lib/utils"

interface Props {
  rowLabels: string[]
  colLabels: string[]
  data: string[][]
  rowHeader?: string
  colHeader?: string
}

export function SensitivityTable({ rowLabels, colLabels, data, rowHeader, colHeader }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-muted-foreground bg-muted/50 border border-border">
              {rowHeader ?? ""}
              {colHeader && <span className="text-muted-foreground/60"> / {colHeader}</span>}
            </th>
            {colLabels.map((c) => (
              <th key={c} className="px-3 py-2 text-center bg-muted/50 border border-border text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={rowLabels[i]}>
              <td className="px-3 py-1.5 font-semibold bg-muted/30 border border-border text-muted-foreground">
                {rowLabels[i]}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-3 py-1.5 text-center border border-border",
                    cell === "N/A" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
