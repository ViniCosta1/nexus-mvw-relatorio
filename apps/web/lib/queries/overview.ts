import { prisma } from "@/lib/db"
import { clampFrom } from "@/lib/config"
import { channelForSeller, shortProductName } from "@/lib/sales"

export interface DateRange {
  from: Date
  to: Date
}

export function getDefaultDateRange(days = 60): DateRange {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return { from, to }
}

/**
 * Resolves the from/to query params into a DateRange, defaulting to the last 60
 * days. The lower bound is clamped to the account-management start date
 * (2026-06-01) so no Meta Ads view — default, preset, or hand-picked — reaches
 * into the prior agency's period.
 *
 * `clamp: false` opts out, for data streams the clamp doesn't govern: the
 * Instagram page reports organic activity, which was never under the prior
 * agency's spend, so its backfilled days must stay visible.
 */
export function resolveRange(
  from?: string,
  to?: string,
  options: { clamp?: boolean } = {},
): DateRange {
  const floor = (d: Date) => (options.clamp === false ? d : clampFrom(d))
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T00:00:00.000Z`)
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return { from: floor(fromDate), to: toDate }
    }
  }
  const def = getDefaultDateRange(60)
  return { from: floor(def.from), to: def.to }
}

export function previousPeriod(range: DateRange): DateRange {
  const lengthMs = range.to.getTime() - range.from.getTime()
  const to = new Date(range.from.getTime() - 24 * 60 * 60 * 1000)
  const from = new Date(to.getTime() - lengthMs)
  return { from, to }
}

/**
 * Meta ad spend and Greenn ticket sales are two independent data streams (no UTM
 * attribution wires a sale back to a campaign) — these KPIs are reported side by
 * side, never combined into a cross-metric like ROAS, which would misleadingly
 * imply a causal link that isn't tracked.
 */
export interface KpiSummary {
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  cpc: number
  totalRevenue: number
  avgTicket: number
  salesCount: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

export async function getKpiSummary(range: DateRange): Promise<KpiSummary> {
  const [insights, sales, previousSales] = await Promise.all([
    prisma.adInsightDaily.findMany({
      where: { date: { gte: clampFrom(range.from), lte: range.to } },
      select: { spend: true, impressions: true, clicks: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: range.from, lte: range.to } },
      select: { amount: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: previousPeriod(range).from, lte: previousPeriod(range).to } },
      select: { amount: true },
    }),
  ])

  const totalSpend = insights.reduce((sum, i) => sum + Number(i.spend), 0)
  const totalImpressions = insights.reduce((sum, i) => sum + i.impressions, 0)
  const totalClicks = insights.reduce((sum, i) => sum + i.clicks, 0)
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const previousPeriodRevenue = previousSales.reduce((sum, s) => sum + Number(s.amount), 0)

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    totalRevenue,
    avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
    salesCount: sales.length,
    currentPeriodRevenue: totalRevenue,
    previousPeriodRevenue,
  }
}

/**
 * The strategy is encoded as the 3rd bracketed token of the campaign name, e.g.
 * "[MVW][2607][ENGAJAMENTO] - Live Rafa" -> "ENGAJAMENTO". Names that don't
 * follow the convention fall back to "SEM ESTRATÉGIA".
 */
export function parseStrategy(name: string): string {
  const tokens = [...name.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]?.trim() ?? "")
  const strategy = tokens[2]
  return strategy && strategy.length > 0 ? strategy.toUpperCase() : "SEM ESTRATÉGIA"
}

/**
 * Percentage return of the period: how much the ticket revenue exceeded the ad
 * spend, as a share of that spend. `null` when nothing was invested, since a
 * return over zero has no meaning.
 *
 * This is a *period-level* comparison, not attribution. No UTM or pixel wires a
 * Greenn sale back to a Meta ad here, so some of this revenue came from sources
 * that never touched an ad — the UI labels it that way and the number must never
 * be read as "each real invested returned X through the ads".
 */
export function periodRoi(totalRevenue: number, totalSpend: number): number | null {
  if (totalSpend === 0) return null
  return ((totalRevenue - totalSpend) / totalSpend) * 100
}

export type DeliveryState = "DELIVERING" | "STOPPED" | "NO_DATA"

export interface CampaignDelivery {
  state: DeliveryState
  /** Last day the campaign actually served impressions, YYYY-MM-DD. */
  lastDay: string | null
}

/** A day older than this many days back can no longer support a "delivering" claim. */
const DELIVERY_FRESHNESS_DAYS = 1

/**
 * Whether a campaign was still serving at the end of the reported period.
 *
 * Meta's own `effective_status` never reaches this database — the Make scenario
 * only sends insights — so a stored status column would be a guess dressed up as
 * fact. This derives the answer from the two things we do have: the last day the
 * campaign served impressions, and how recent the data itself is.
 *
 * A campaign only counts as delivering when it served on the newest collected
 * day *and* that day is at most one day old. Yesterday is allowed because the
 * current day is still accumulating; anything older means the pipeline went
 * quiet, and "still running" would be a claim the data can't support.
 */
export function deliveryStatus(
  lastDayWithImpressions: string | null,
  latestCollectedDay: string | null,
  todayDay: string,
): CampaignDelivery {
  if (!lastDayWithImpressions) return { state: "NO_DATA", lastDay: null }

  const freshnessFloor = new Date(`${todayDay}T00:00:00.000Z`)
  freshnessFloor.setUTCDate(freshnessFloor.getUTCDate() - DELIVERY_FRESHNESS_DAYS)
  const isFresh = (latestCollectedDay ?? "") >= freshnessFloor.toISOString().slice(0, 10)

  return {
    state: lastDayWithImpressions === latestCollectedDay && isFresh ? "DELIVERING" : "STOPPED",
    lastDay: lastDayWithImpressions,
  }
}

/** Campaign-level metrics derived purely from Meta ad insights — no sales data mixed in. */
export interface CampaignPerformanceRow {
  campaignId: string
  name: string
  strategy: string
  /** Sortable state; `lastDeliveryDay` carries the date the UI shows with it. */
  delivery: DeliveryState
  lastDeliveryDay: string | null
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpc: number
  cpm: number
  adCount: number
}

export async function getCampaignPerformance(range: DateRange, search?: string): Promise<CampaignPerformanceRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    include: {
      ads: { include: { insights: { where: { date: { gte: clampFrom(range.from), lte: range.to } } } } },
    },
  })

  // The freshest day with any delivery in the whole period. Campaigns that also
  // served on it are still running; the rest stopped earlier.
  const latestCollectedDay = campaigns
    .flatMap((c) => c.ads.flatMap((ad) => ad.insights))
    .filter((i) => i.impressions > 0)
    .reduce<string | null>((latest, i) => {
      const day = i.date.toISOString().slice(0, 10)
      return latest === null || day > latest ? day : latest
    }, null)

  return campaigns
    .map((c) => {
      const allInsights = c.ads.flatMap((ad) => ad.insights)
      const lastDayWithImpressions = allInsights
        .filter((i) => i.impressions > 0)
        .reduce<string | null>((latest, i) => {
          const day = i.date.toISOString().slice(0, 10)
          return latest === null || day > latest ? day : latest
        }, null)
      const delivery = deliveryStatus(
        lastDayWithImpressions,
        latestCollectedDay,
        new Date().toISOString().slice(0, 10),
      )
      const spend = allInsights.reduce((sum, i) => sum + Number(i.spend), 0)
      const impressions = allInsights.reduce((sum, i) => sum + i.impressions, 0)
      const clicks = allInsights.reduce((sum, i) => sum + i.clicks, 0)
      const reach = allInsights.reduce((sum, i) => sum + i.reach, 0)
      const adCount = c.ads.filter((ad) => ad.insights.length > 0).length
      return {
        campaignId: c.id,
        name: c.name,
        strategy: parseStrategy(c.name),
        delivery: delivery.state,
        lastDeliveryDay: delivery.lastDay,
        spend,
        impressions,
        clicks,
        reach,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        adCount,
      }
    })
    .filter((c) => c.impressions > 0)
    .sort((a, b) => b.spend - a.spend)
}

/** Aggregated Meta performance grouped by campaign strategy (the 3rd name token). */
export interface StrategyPerformanceRow {
  strategy: string
  campaignCount: number
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
}

export async function getStrategyPerformance(range: DateRange, search?: string): Promise<StrategyPerformanceRow[]> {
  const campaigns = await getCampaignPerformance(range, search)
  const byStrategy = new Map<string, StrategyPerformanceRow>()
  for (const c of campaigns) {
    const cur =
      byStrategy.get(c.strategy) ??
      { strategy: c.strategy, campaignCount: 0, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0 }
    cur.campaignCount += 1
    cur.spend += c.spend
    cur.impressions += c.impressions
    cur.clicks += c.clicks
    byStrategy.set(c.strategy, cur)
  }
  return [...byStrategy.values()]
    .map((s) => ({
      ...s,
      ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
      cpc: s.clicks > 0 ? s.spend / s.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
}

export interface AdRankingRow {
  adId: string
  metaAdId: string
  name: string
  campaignName: string
  adsetName: string | null
  creativeType: string | null
  thumbnailUrl: string | null
  imageUrl: string | null
  permalinkUrl: string | null
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  reach: number
  cpm: number
}

export async function getAdRanking(range: DateRange, search?: string): Promise<AdRankingRow[]> {
  return getFullAdList(range, search)
}

export async function getFullAdList(range: DateRange, search?: string): Promise<AdRankingRow[]> {
  const ads = await prisma.ad.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { campaign: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      campaign: { select: { name: true } },
      insights: { where: { date: { gte: clampFrom(range.from), lte: range.to } } },
    },
  })

  return ads
    .map((ad) => {
      const spend = ad.insights.reduce((sum, i) => sum + Number(i.spend), 0)
      const impressions = ad.insights.reduce((sum, i) => sum + i.impressions, 0)
      const clicks = ad.insights.reduce((sum, i) => sum + i.clicks, 0)
      const reach = ad.insights.reduce((sum, i) => sum + i.reach, 0)
      return {
        adId: ad.id,
        metaAdId: ad.metaAdId,
        name: ad.name,
        campaignName: ad.campaign.name,
        adsetName: ad.adsetName,
        creativeType: ad.creativeType,
        thumbnailUrl: ad.thumbnailUrl,
        imageUrl: ad.imageUrl,
        permalinkUrl: ad.permalinkUrl,
        spend,
        impressions,
        clicks,
        reach,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      }
    })
    .filter((ad) => ad.impressions > 0)
    .sort((a, b) => b.ctr - a.ctr)
}

export interface SellerRankingRow {
  sellerName: string
  revenue: number
  salesCount: number
}

export async function getSellerRanking(range: DateRange, search?: string): Promise<SellerRankingRow[]> {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: range.from, lte: range.to },
      ...(search ? { sellerName: { contains: search, mode: "insensitive" } } : {}),
    },
    select: { sellerName: true, amount: true },
  })

  const bySeller = new Map<string, SellerRankingRow>()
  for (const s of sales) {
    const current = bySeller.get(s.sellerName) ?? { sellerName: s.sellerName, revenue: 0, salesCount: 0 }
    current.revenue += Number(s.amount)
    current.salesCount += 1
    bySeller.set(s.sellerName, current)
  }

  return [...bySeller.values()].sort((a, b) => b.revenue - a.revenue)
}

export interface SalesHighlightEntry {
  label: string
  salesCount: number
  revenue: number
}

export interface SalesHighlights {
  salesCount: number
  revenue: number
  avgTicket: number
  freeCount: number
  topChannel?: SalesHighlightEntry
  topProductPaid?: SalesHighlightEntry
  topProductFree?: SalesHighlightEntry
  topSeller?: SalesHighlightEntry
}

/** Standout numbers for the sales page: leading channel, product and seller by
 *  volume, plus period totals. Channel/product use the same display transforms
 *  as the table so the highlights match what's listed. */
export async function getSalesHighlights(range: DateRange, search?: string): Promise<SalesHighlights> {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: range.from, lte: range.to },
      ...(search
        ? {
            OR: [
              { clientName: { contains: search, mode: "insensitive" } },
              { sellerName: { contains: search, mode: "insensitive" } },
              { productName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { sellerName: true, productName: true, amount: true },
  })

  const revenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const freeCount = sales.filter((s) => Number(s.amount) <= 0).length
  const paidCount = sales.length - freeCount

  const topBy = (
    keyOf: (s: (typeof sales)[number]) => string,
    filter?: (s: (typeof sales)[number]) => boolean,
  ): SalesHighlightEntry | undefined => {
    const map = new Map<string, SalesHighlightEntry>()
    for (const s of sales) {
      if (filter && !filter(s)) continue
      const label = keyOf(s)
      const cur = map.get(label) ?? { label, salesCount: 0, revenue: 0 }
      cur.salesCount += 1
      cur.revenue += Number(s.amount)
      map.set(label, cur)
    }
    return [...map.values()].sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)[0]
  }

  const product = (s: (typeof sales)[number]) => shortProductName(s.productName)
  return {
    salesCount: sales.length,
    revenue,
    avgTicket: paidCount > 0 ? revenue / paidCount : 0,
    freeCount,
    topChannel: topBy((s) => channelForSeller(s.sellerName)),
    topProductPaid: topBy(product, (s) => Number(s.amount) > 0),
    topProductFree: topBy(product, (s) => Number(s.amount) <= 0),
    topSeller: topBy((s) => s.sellerName),
  }
}

export interface SaleRow {
  id: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  sellerName: string
  productName: string
  amount: number
  saleDate: string
  channel: string
}

export async function getSalesList(range: DateRange, search?: string): Promise<SaleRow[]> {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: range.from, lte: range.to },
      ...(search
        ? {
            OR: [
              { clientName: { contains: search, mode: "insensitive" } },
              { sellerName: { contains: search, mode: "insensitive" } },
              { productName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { saleDate: "desc" },
  })

  return sales.map((s) => ({
    id: s.id,
    clientName: s.clientName,
    clientEmail: s.clientEmail,
    clientPhone: s.clientPhone,
    sellerName: s.sellerName,
    productName: shortProductName(s.productName),
    amount: Number(s.amount),
    saleDate: s.saleDate.toISOString().slice(0, 10),
    channel: channelForSeller(s.sellerName),
  }))
}

export interface SpendVsSalesPoint {
  date: string
  spend: number
  revenue: number
}

export async function getSpendVsSalesSeries(range: DateRange): Promise<SpendVsSalesPoint[]> {
  const [insights, sales] = await Promise.all([
    prisma.adInsightDaily.findMany({
      where: { date: { gte: clampFrom(range.from), lte: range.to } },
      select: { date: true, spend: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: range.from, lte: range.to } },
      select: { saleDate: true, amount: true },
    }),
  ])

  const byDate = new Map<string, SpendVsSalesPoint>()
  const key = (d: Date) => d.toISOString().slice(0, 10)

  for (const i of insights) {
    const k = key(i.date)
    const point = byDate.get(k) ?? { date: k, spend: 0, revenue: 0 }
    point.spend += Number(i.spend)
    byDate.set(k, point)
  }
  for (const s of sales) {
    const k = key(s.saleDate)
    const point = byDate.get(k) ?? { date: k, spend: 0, revenue: 0 }
    point.revenue += Number(s.amount)
    byDate.set(k, point)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
