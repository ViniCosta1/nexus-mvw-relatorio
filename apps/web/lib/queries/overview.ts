import { prisma } from "@/lib/db"

export interface DateRange {
  from: Date
  to: Date
}

export function getDefaultDateRange(days = 30): DateRange {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return { from, to }
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
  totalRevenue: number
  avgTicket: number
  salesCount: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

export async function getKpiSummary(range: DateRange): Promise<KpiSummary> {
  const [insights, sales, previousSales] = await Promise.all([
    prisma.adInsightDaily.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { spend: true },
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
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const previousPeriodRevenue = previousSales.reduce((sum, s) => sum + Number(s.amount), 0)

  return {
    totalSpend,
    totalRevenue,
    avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
    salesCount: sales.length,
    currentPeriodRevenue: totalRevenue,
    previousPeriodRevenue,
  }
}

/** Campaign-level metrics derived purely from Meta ad insights — no sales data mixed in. */
export interface CampaignPerformanceRow {
  campaignId: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
}

export async function getCampaignPerformance(range: DateRange, search?: string): Promise<CampaignPerformanceRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    include: {
      ads: { include: { insights: { where: { date: { gte: range.from, lte: range.to } } } } },
    },
  })

  return campaigns
    .map((c) => {
      const allInsights = c.ads.flatMap((ad) => ad.insights)
      const spend = allInsights.reduce((sum, i) => sum + Number(i.spend), 0)
      const impressions = allInsights.reduce((sum, i) => sum + i.impressions, 0)
      const clicks = allInsights.reduce((sum, i) => sum + i.clicks, 0)
      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        spend,
        impressions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
      }
    })
    .filter((c) => c.impressions > 0)
    .sort((a, b) => b.spend - a.spend)
}

export interface AdRankingRow {
  adId: string
  name: string
  campaignName: string
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
      insights: { where: { date: { gte: range.from, lte: range.to } } },
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
        name: ad.name,
        campaignName: ad.campaign.name,
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
    productName: s.productName,
    amount: Number(s.amount),
    saleDate: s.saleDate.toISOString().slice(0, 10),
    channel: s.channel,
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
      where: { date: { gte: range.from, lte: range.to } },
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
