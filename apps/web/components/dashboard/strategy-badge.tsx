import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

// Light-bg / dark-text pairs, readable on the light theme. A strategy always maps
// to the same color so it's visually identifiable across tables.
const PALETTE = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-lime-100 text-lime-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800",
]

function colorFor(strategy: string): string {
  let hash = 0
  for (let i = 0; i < strategy.length; i++) hash = (hash * 31 + strategy.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

export function StrategyBadge({ strategy, className }: { strategy: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", colorFor(strategy), className)}>
      {strategy}
    </Badge>
  )
}
