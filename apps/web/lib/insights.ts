/**
 * All insights here are stated in positive/neutral terms only — no warnings, no
 * "campaign underperformed" framing. Meta spend and Greenn sales are independent
 * data streams (no UTM attribution), so nothing here implies a causal link
 * between the two. The manager draws their own conclusions from the raw numbers
 * shown elsewhere on the page; this panel only calls out clear positive facts.
 */

export interface CampaignEfficiency {
  campaignId: string
  name: string
  clicks: number
  impressions: number
  ctr: number
  cpc: number
}

export interface Insight {
  id: string
  tone: "positive"
  message: string
}

export interface BuildInsightsInput {
  campaigns: CampaignEfficiency[]
  totalRevenue: number
  salesCount: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

const MIN_IMPRESSIONS_FOR_CTR_HIGHLIGHT = 100
const MIN_CLICKS_FOR_CPC_HIGHLIGHT = 5

export function buildInsights(input: BuildInsightsInput): Insight[] {
  const insights: Insight[] = []
  const { campaigns, totalRevenue, salesCount, currentPeriodRevenue, previousPeriodRevenue } = input

  const byCtr = campaigns
    .filter((c) => c.impressions >= MIN_IMPRESSIONS_FOR_CTR_HIGHLIGHT)
    .sort((a, b) => b.ctr - a.ctr)[0]
  if (byCtr) {
    insights.push({
      id: "best-ctr",
      tone: "positive",
      message: `"${byCtr.name}" teve o melhor CTR do período (${byCtr.ctr.toFixed(2)}%).`,
    })
  }

  const byCpc = campaigns
    .filter((c) => c.clicks >= MIN_CLICKS_FOR_CPC_HIGHLIGHT)
    .sort((a, b) => a.cpc - b.cpc)[0]
  if (byCpc && byCpc.campaignId !== byCtr?.campaignId) {
    insights.push({
      id: "best-cpc",
      tone: "positive",
      message: `"${byCpc.name}" teve o menor custo por clique do período (${byCpc.cpc.toFixed(2)} por clique).`,
    })
  }

  if (previousPeriodRevenue > 0) {
    const change = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    if (change >= 0) {
      insights.push({
        id: "period-trend",
        tone: "positive",
        message: `Vendas de ingressos cresceram ${change.toFixed(0)}% em relação ao período anterior.`,
      })
    }
  }

  if (salesCount > 0) {
    insights.push({
      id: "sales-summary",
      tone: "positive",
      message: `Foram vendidos ${salesCount} ingressos no período, totalizando ${totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    })
  }

  return insights
}
