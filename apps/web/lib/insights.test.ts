import { describe, expect, it } from "vitest"
import { buildInsights } from "./insights"

const baseCampaigns = [
  { campaignId: "1", name: "Campanha A", clicks: 200, impressions: 5000, ctr: 4.0, cpc: 1.2 },
  { campaignId: "2", name: "Campanha B", clicks: 50, impressions: 8000, ctr: 0.6, cpc: 0.5 },
  { campaignId: "3", name: "Campanha C", clicks: 10, impressions: 50, ctr: 20.0, cpc: 3.0 },
]

describe("buildInsights", () => {
  it("aponta a campanha com melhor CTR, ignorando campanhas com poucas impressões", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      totalRevenue: 0,
      salesCount: 0,
      currentPeriodRevenue: 0,
      previousPeriodRevenue: 0,
    })
    const best = insights.find((i) => i.id === "best-ctr")
    expect(best).toBeDefined()
    expect(best?.message).toContain("Campanha A")
    expect(best?.message).toContain("4.00%")
    expect(best?.tone).toBe("positive")
  })

  it("aponta a campanha com menor CPC, ignorando campanhas com poucos cliques", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      totalRevenue: 0,
      salesCount: 0,
      currentPeriodRevenue: 0,
      previousPeriodRevenue: 0,
    })
    const best = insights.find((i) => i.id === "best-cpc")
    expect(best).toBeDefined()
    expect(best?.message).toContain("Campanha B")
  })

  it("nunca gera insight de tom negativo", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      totalRevenue: 100,
      salesCount: 1,
      currentPeriodRevenue: 100,
      previousPeriodRevenue: 500,
    })
    expect(insights.every((i) => i.tone === "positive")).toBe(true)
    expect(insights.find((i) => i.id === "period-trend")).toBeUndefined()
  })

  it("calcula variacao percentual positiva vs periodo anterior", () => {
    const insights = buildInsights({
      campaigns: [],
      totalRevenue: 6400,
      salesCount: 10,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 3200,
    })
    const trend = insights.find((i) => i.id === "period-trend")
    expect(trend?.message).toContain("100%")
    expect(trend?.tone).toBe("positive")
  })

  it("resume total de vendas quando ha vendas no periodo", () => {
    const insights = buildInsights({
      campaigns: [],
      totalRevenue: 8369.4,
      salesCount: 105,
      currentPeriodRevenue: 8369.4,
      previousPeriodRevenue: 0,
    })
    const summary = insights.find((i) => i.id === "sales-summary")
    expect(summary).toBeDefined()
    expect(summary?.message).toContain("105")
  })
})
