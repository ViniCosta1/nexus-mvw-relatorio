import { Badge } from "@workspace/ui/components/badge"
import { formatDateBR } from "@/lib/format"
import type { DeliveryState } from "@/lib/queries/overview"

/**
 * Delivery state of a campaign, derived from its insights rather than from
 * Meta's status (which this pipeline never receives). "Veiculando" carries the
 * date it refers to, because the last collected day usually lags today — the
 * badge reports what the data shows, not what the ad account is doing right now.
 */
export function DeliveryBadge({ state, lastDay }: { state: DeliveryState; lastDay: string | null }) {
  if (state === "NO_DATA") {
    return (
      <Badge variant="outline" title="Nenhuma impressão registrada no período selecionado.">
        Sem veiculação
      </Badge>
    )
  }

  const day = lastDay ? formatDateBR(`${lastDay}T00:00:00.000Z`) : null

  if (state === "DELIVERING") {
    return (
      <Badge variant="default" title={`Teve impressões no dia mais recente com dados (${day}).`}>
        Veiculando até {day}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" title="Sem impressões depois desta data no período selecionado.">
      Parada desde {day}
    </Badge>
  )
}
