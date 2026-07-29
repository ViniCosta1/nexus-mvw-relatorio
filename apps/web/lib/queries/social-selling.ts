import { prisma } from "@/lib/db"

/**
 * Social selling cadences. These are targets the operation works to, kept as a
 * range because that is how the routine is actually run — reducing "30 a 60
 * abordagens por dia" to a single average would report a precision the work
 * doesn't have.
 */
export interface SocialSellingMetricRow {
  id: string
  key: string
  label: string
  minValue: number
  maxValue: number
  unit: string
  cadence: string
}

export interface SocialSellingNoteRow {
  id: string
  key: string
  title: string
  body: string
  tone: "ALERTA" | "NEUTRO" | "POSITIVO"
}

const nf = (n: number) => n.toLocaleString("pt-BR")

/** "30 a 60", or just "30" when both ends match. */
export function formatMetricValue(metric: SocialSellingMetricRow): string {
  return metric.minValue === metric.maxValue
    ? nf(metric.minValue)
    : `${nf(metric.minValue)} a ${nf(metric.maxValue)}`
}

/** "abordagens por dia" — the unit read under the number. */
export function formatMetricRange(metric: SocialSellingMetricRow): string {
  return metric.cadence ? `${metric.unit} ${metric.cadence}` : metric.unit
}

export async function getSocialSellingMetrics(): Promise<SocialSellingMetricRow[]> {
  const rows = await prisma.socialSellingMetric.findMany({ orderBy: { position: "asc" } })

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    minValue: r.minValue,
    maxValue: r.maxValue,
    unit: r.unit,
    cadence: r.cadence,
  }))
}

export async function getSocialSellingNotes(): Promise<SocialSellingNoteRow[]> {
  const rows = await prisma.socialSellingNote.findMany({ orderBy: { position: "asc" } })

  return rows.map((r) => ({ id: r.id, key: r.key, title: r.title, body: r.body, tone: r.tone }))
}
