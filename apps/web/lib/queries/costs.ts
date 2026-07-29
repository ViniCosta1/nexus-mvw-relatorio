import { prisma } from "@/lib/db"

/**
 * Costs are modelled in whole months (`YYYY-MM`), never in days: every line item
 * here is a monthly subscription, a retainer or a one-off charge booked to a
 * month. Keeping the unit coarse avoids inventing a daily proration that no
 * invoice actually has.
 */
export type MonthKey = string

export interface CostRow {
  id: string
  name: string
  category: string
  amount: number
  kind: "MONTHLY" | "ONE_OFF"
  startMonth: MonthKey
  endMonth: MonthKey | null
  /** True when part of the cost is a commission or similar with no fixed value. */
  hasVariable: boolean
  note: string | null
}

export interface MonthTotal {
  month: MonthKey
  total: number
}

function toMonthKey(date: Date): MonthKey {
  return date.toISOString().slice(0, 7)
}

/** Whether the cost was charged in the given month. */
export function costAppliesToMonth(cost: CostRow, month: MonthKey): boolean {
  if (month < cost.startMonth) return false
  return cost.endMonth === null || month <= cost.endMonth
}

/**
 * The recurring bill for a month — what keeps being charged. One-off items are
 * deliberately excluded even in the month they hit, since this number answers
 * "what does the operation cost per month from here on".
 */
export function recurringMonthlyTotal(costs: CostRow[], month: MonthKey): number {
  return costs
    .filter((c) => c.kind === "MONTHLY" && costAppliesToMonth(c, month))
    .reduce((sum, c) => sum + c.amount, 0)
}

/** Everything charged in that month, recurring plus one-off. */
export function totalForMonth(costs: CostRow[], month: MonthKey): number {
  return costs.filter((c) => costAppliesToMonth(c, month)).reduce((sum, c) => sum + c.amount, 0)
}

/** Every month from the earliest cost up to the reference month, inclusive. */
export function monthsInRange(costs: CostRow[], referenceMonth: MonthKey): MonthKey[] {
  const earliest = costs.reduce<MonthKey | null>(
    (min, c) => (min === null || c.startMonth < min ? c.startMonth : min),
    null,
  )
  if (earliest === null || earliest > referenceMonth) return [referenceMonth]

  const months: MonthKey[] = []
  const cursor = new Date(`${earliest}-01T00:00:00.000Z`)
  const end = new Date(`${referenceMonth}-01T00:00:00.000Z`)
  while (cursor.getTime() <= end.getTime()) {
    months.push(toMonthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

export async function getCosts(): Promise<CostRow[]> {
  const rows = await prisma.cost.findMany({ orderBy: [{ category: "asc" }, { amount: "desc" }] })

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: Number(r.amount),
    kind: r.kind,
    startMonth: toMonthKey(r.startMonth),
    endMonth: r.endMonth ? toMonthKey(r.endMonth) : null,
    hasVariable: r.hasVariable,
    note: r.note,
  }))
}

export function buildMonthTotals(costs: CostRow[], referenceMonth: MonthKey): MonthTotal[] {
  return monthsInRange(costs, referenceMonth).map((month) => ({
    month,
    total: totalForMonth(costs, month),
  }))
}
