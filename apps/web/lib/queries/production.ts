import { prisma } from "@/lib/db"

/**
 * Design output delivered to the client. Deliberately disconnected from ad spend
 * and from sales: a piece of art is not attributed to a campaign or a ticket,
 * and mixing them would invent a relationship nothing here tracks.
 */
export interface DeliveryRow {
  id: string
  key: string
  label: string
  kind: "ARTE" | "VIDEO" | "MARCO"
  /** `YYYY-MM`, or null for one-off milestones (site, logos). */
  month: string | null
  /** Null for milestones, which are a single delivery rather than a count. */
  quantity: number | null
}

export interface DeliveryTotals {
  artes: number
  videos: number
  total: number
}

export interface DeliveryMonthGroup {
  month: string
  total: number
  items: DeliveryRow[]
}

export function sumDeliveries(rows: DeliveryRow[]): DeliveryTotals {
  const artes = rows
    .filter((r) => r.kind === "ARTE")
    .reduce((sum, r) => sum + (r.quantity ?? 0), 0)
  const videos = rows
    .filter((r) => r.kind === "VIDEO")
    .reduce((sum, r) => sum + (r.quantity ?? 0), 0)
  return { artes, videos, total: artes + videos }
}

/** Counted deliveries grouped by month, newest first; milestones are excluded. */
export function groupDeliveriesByMonth(rows: DeliveryRow[]): DeliveryMonthGroup[] {
  const byMonth = new Map<string, DeliveryRow[]>()
  for (const row of rows) {
    if (row.month === null || row.kind === "MARCO") continue
    const bucket = byMonth.get(row.month)
    if (bucket) bucket.push(row)
    else byMonth.set(row.month, [row])
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => ({
      month,
      total: items.reduce((sum, i) => sum + (i.quantity ?? 0), 0),
      items: [...items].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    }))
}

export async function getDeliveries(): Promise<DeliveryRow[]> {
  const rows = await prisma.designDelivery.findMany({ orderBy: [{ month: "desc" }, { label: "asc" }] })

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    kind: r.kind,
    month: r.month ? r.month.toISOString().slice(0, 7) : null,
    quantity: r.quantity,
  }))
}
