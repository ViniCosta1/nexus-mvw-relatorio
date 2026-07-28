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

export interface KpiSummary {
  totalSpend: number
  totalRevenue: number
  roas: number
  avgTicket: number
  salesCount: number
  unattributedRevenue: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

export async function getKpiSummary(range: DateRange): Promise<KpiSummary> {
  const [insights, sales, previousSales] = await Promise.all([
    prisma.campaignInsightDaily.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { spend: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: range.from, lte: range.to } },
      select: { amount: true, campaignId: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: previousPeriod(range).from, lte: previousPeriod(range).to } },
      select: { amount: true },
    }),
  ])

  const totalSpend = insights.reduce((sum, i) => sum + Number(i.spend), 0)
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const unattributedRevenue = sales
    .filter((s) => s.campaignId === null)
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const previousPeriodRevenue = previousSales.reduce((sum, s) => sum + Number(s.amount), 0)

  return {
    totalSpend,
    totalRevenue,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
    salesCount: sales.length,
    unattributedRevenue,
    currentPeriodRevenue: totalRevenue,
    previousPeriodRevenue,
  }
}

export interface CampaignRankingRow {
  campaignId: string
  name: string
  status: string
  spend: number
  revenue: number
  roas: number
  salesCount: number
}

export async function getCampaignRanking(range: DateRange): Promise<CampaignRankingRow[]> {
  const campaigns = await prisma.campaign.findMany({
    include: {
      insights: { where: { date: { gte: range.from, lte: range.to } } },
      sales: { where: { saleDate: { gte: range.from, lte: range.to } } },
    },
  })

  return campaigns
    .map((c) => {
      const spend = c.insights.reduce((sum, i) => sum + Number(i.spend), 0)
      const revenue = c.sales.reduce((sum, s) => sum + Number(s.amount), 0)
      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        spend,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        salesCount: c.sales.length,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

export interface SellerRankingRow {
  sellerName: string
  revenue: number
  salesCount: number
}

export async function getSellerRanking(range: DateRange): Promise<SellerRankingRow[]> {
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: range.from, lte: range.to } },
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

export interface SpendVsSalesPoint {
  date: string
  spend: number
  revenue: number
}

export async function getSpendVsSalesSeries(range: DateRange): Promise<SpendVsSalesPoint[]> {
  const [insights, sales] = await Promise.all([
    prisma.campaignInsightDaily.findMany({
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
