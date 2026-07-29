import { ACCOUNT_START_DATE } from "@/lib/config"
import { formatDateFullBR } from "@/lib/format"

/**
 * Standing note that the reported traffic began on the account-management start
 * date. Everything before it belonged to a prior agency and is excluded, so this
 * makes the reporting window explicit on every page.
 */
export function TrafficStartNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Tráfego iniciado em{" "}
      <span className="text-foreground font-semibold">{formatDateFullBR(ACCOUNT_START_DATE)}</span>. Dados anteriores a
      esta data são de outra gestão e não entram no relatório.
    </p>
  )
}
