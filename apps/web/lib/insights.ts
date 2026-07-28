export interface CampaignPerformance {
  campaignId: string
  name: string
  spend: number
  revenue: number
}

export interface Insight {
  id: string
  tone: "positive" | "warning" | "neutral"
  message: string
}

export interface BuildInsightsInput {
  campaigns: CampaignPerformance[]
  unattributedRevenue: number
  totalRevenue: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

const HIGH_SPEND_SHARE_THRESHOLD = 0.25
const LOW_RETURN_SHARE_RATIO = 0.5
const UNATTRIBUTED_SHARE_THRESHOLD = 0.2

export function buildInsights(input: BuildInsightsInput): Insight[] {
  const insights: Insight[] = []
  const { campaigns, unattributedRevenue, totalRevenue, currentPeriodRevenue, previousPeriodRevenue } = input

  const withRoas = campaigns
    .filter((c) => c.spend > 0)
    .map((c) => ({ ...c, roas: c.revenue / c.spend }))

  if (withRoas.length > 0) {
    const best = withRoas.reduce((a, b) => (b.roas > a.roas ? b : a))
    insights.push({
      id: "best-roas",
      tone: "positive",
      message: `"${best.name}" teve o melhor ROAS do período (${best.roas.toFixed(1)}x).`,
    })
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0)
  if (totalSpend > 0 && totalRevenue > 0) {
    for (const c of campaigns) {
      const spendShare = c.spend / totalSpend
      const revenueShare = c.revenue / totalRevenue
      if (spendShare >= HIGH_SPEND_SHARE_THRESHOLD && revenueShare < spendShare * LOW_RETURN_SHARE_RATIO) {
        insights.push({
          id: "low-return-high-spend",
          tone: "warning",
          message: `"${c.name}" consumiu ${(spendShare * 100).toFixed(0)}% do investimento mas gerou só ${(revenueShare * 100).toFixed(0)}% das vendas.`,
        })
        break
      }
    }
  }

  if (previousPeriodRevenue > 0) {
    const change = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    insights.push({
      id: "period-trend",
      tone: change >= 0 ? "positive" : "warning",
      message: `Faturamento ${change >= 0 ? "subiu" : "caiu"} ${Math.abs(change).toFixed(0)}% em relação ao período anterior.`,
    })
  }

  if (totalRevenue > 0 && unattributedRevenue / totalRevenue >= UNATTRIBUTED_SHARE_THRESHOLD) {
    insights.push({
      id: "unattributed-share",
      tone: "warning",
      message: `${((unattributedRevenue / totalRevenue) * 100).toFixed(0)}% das vendas do período não têm campanha de origem identificada.`,
    })
  }

  return insights
}
