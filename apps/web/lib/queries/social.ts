import { prisma } from "@/lib/db"
import { previousPeriod, type DateRange } from "@/lib/queries/overview"

export interface SocialTotals {
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  follows: number
  unfollows: number
  followsNet: number
}

export interface SocialDailyRow {
  date: string
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  likes: number
  comments: number
  saves: number
  shares: number
  followsNet: number
}

export interface SocialSeriesPoint {
  date: string
  reach: number | null
  views: number | null
  followsNet: number | null
}

export interface SocialSummary {
  current: SocialTotals
  previous: SocialTotals
}

const EMPTY_TOTALS: SocialTotals = {
  reach: 0,
  views: 0,
  totalInteractions: 0,
  accountsEngaged: 0,
  follows: 0,
  unfollows: 0,
  followsNet: 0,
}

export function sumSocialTotals(rows: SocialTotals[]): SocialTotals {
  return rows.reduce<SocialTotals>(
    (acc, r) => ({
      reach: acc.reach + r.reach,
      views: acc.views + r.views,
      totalInteractions: acc.totalInteractions + r.totalInteractions,
      accountsEngaged: acc.accountsEngaged + r.accountsEngaged,
      follows: acc.follows + r.follows,
      unfollows: acc.unfollows + r.unfollows,
      followsNet: acc.followsNet + r.followsNet,
    }),
    { ...EMPTY_TOTALS },
  )
}

/**
 * Expands the collected rows into one point per calendar day in the range,
 * leaving days we never received as `null`. A missing day means the Make
 * scenario didn't run — plotting it as 0 would read as "no reach that day",
 * which is a different and false claim.
 */
export function buildSocialSeries(rows: SocialDailyRow[], range: DateRange): SocialSeriesPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const points: SocialSeriesPoint[] = []
  const cursor = new Date(range.from.getTime())
  while (cursor.getTime() <= range.to.getTime()) {
    const day = cursor.toISOString().slice(0, 10)
    const row = byDate.get(day)
    points.push({
      date: day,
      reach: row ? row.reach : null,
      views: row ? row.views : null,
      followsNet: row ? row.followsNet : null,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return points
}

const TOTALS_SELECT = {
  reach: true,
  views: true,
  totalInteractions: true,
  accountsEngaged: true,
  follows: true,
  unfollows: true,
  followsNet: true,
} as const

export async function getSocialSummary(range: DateRange): Promise<SocialSummary> {
  const prev = previousPeriod(range)
  const [current, previous] = await Promise.all([
    prisma.instagramDailyStat.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: TOTALS_SELECT,
    }),
    prisma.instagramDailyStat.findMany({
      where: { date: { gte: prev.from, lte: prev.to } },
      select: TOTALS_SELECT,
    }),
  ])

  return { current: sumSocialTotals(current), previous: sumSocialTotals(previous) }
}

export async function getSocialDaily(range: DateRange): Promise<SocialDailyRow[]> {
  const rows = await prisma.instagramDailyStat.findMany({
    where: { date: { gte: range.from, lte: range.to } },
    orderBy: { date: "desc" },
  })

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    reach: r.reach,
    views: r.views,
    totalInteractions: r.totalInteractions,
    accountsEngaged: r.accountsEngaged,
    likes: r.likes,
    comments: r.comments,
    saves: r.saves,
    shares: r.shares,
    followsNet: r.followsNet,
  }))
}
