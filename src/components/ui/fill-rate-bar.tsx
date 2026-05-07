import { cn } from "@/lib/utils"

function fillColor(pct: number) {
  if (pct >= 80) return { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" }
  if (pct >= 40) return { bar: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-400" }
  return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" }
}

export function FillRateBar({
  value,
  label,
  className,
}: {
  value: number | null | undefined
  label?: string
  className?: string
}) {
  if (value == null) {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {label && <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</span>}
        <span className="text-muted-foreground text-xs">—</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, value))
  const { bar, text } = fillColor(pct)

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {label && (
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-all", bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn("font-mono text-xs font-medium", text)}>
          {pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`}
        </span>
      </div>
    </div>
  )
}
