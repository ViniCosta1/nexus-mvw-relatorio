"use client"

import { Info } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"

export interface KpiInfo {
  what: string
  example: string
  why: string
}

/** Small info icon that opens a popover explaining a KPI (what it is, an example
 *  and why it matters). Click/tap based, so it works on desktop and mobile. */
export function InfoHint({ info, label }: { info: KpiInfo; label: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`O que é ${label}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2"
      >
        <Info size={15} weight="bold" />
      </PopoverTrigger>
      <PopoverContent align="end" className="space-y-2 text-sm">
        <p className="text-foreground font-semibold">{label}</p>
        <p className="text-muted-foreground">{info.what}</p>
        <p>
          <span className="text-foreground font-medium">Exemplo: </span>
          <span className="text-muted-foreground">{info.example}</span>
        </p>
        <p>
          <span className="text-foreground font-medium">Por que importa: </span>
          <span className="text-muted-foreground">{info.why}</span>
        </p>
      </PopoverContent>
    </Popover>
  )
}
