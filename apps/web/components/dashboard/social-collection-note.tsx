import { SOCIAL_COLLECTION_START_DATE } from "@/lib/config"
import { formatDateFullBR } from "@/lib/format"

/**
 * Standing note on the /social page. The Instagram Graph API only retains ~30
 * days of account insights, so the first run backfilled what it still had —
 * days before the collection start exist but were not collected daily, and the
 * note says so instead of quietly presenting them as the same thing.
 */
export function SocialCollectionNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Coleta diária do Instagram iniciada em{" "}
      <span className="text-foreground font-semibold">{formatDateFullBR(SOCIAL_COLLECTION_START_DATE)}</span>. Dias
      anteriores vieram de uma carga única do histórico da API (limite de ~30 dias).
    </p>
  )
}
