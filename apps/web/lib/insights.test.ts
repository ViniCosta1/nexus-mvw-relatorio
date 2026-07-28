import { describe, expect, it } from "vitest"
import { buildInsights } from "./insights"

const baseCampaigns = [
  { campaignId: "1", name: "Campanha A", spend: 1000, revenue: 4000 },
  { campaignId: "2", name: "Campanha B", spend: 3000, revenue: 1500 },
  { campaignId: "3", name: "Campanha C", spend: 500, revenue: 900 },
]

describe("buildInsights", () => {
  it("aponta a campanha com melhor ROAS", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const best = insights.find((i) => i.id === "best-roas")
    expect(best).toBeDefined()
    expect(best?.message).toContain("Campanha A")
    expect(best?.message).toContain("4.0x")
  })

  it("alerta campanha com gasto alto e retorno baixo", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const warning = insights.find((i) => i.id === "low-return-high-spend")
    expect(warning).toBeDefined()
    expect(warning?.message).toContain("Campanha B")
  })

  it("calcula variacao percentual vs periodo anterior", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 3200,
    })
    const trend = insights.find((i) => i.id === "period-trend")
    expect(trend?.message).toContain("100%")
    expect(trend?.tone).toBe("positive")
  })

  it("alerta quando vendas nao atribuidas passam do limiar", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 2000,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const unattributed = insights.find((i) => i.id === "unattributed-share")
    expect(unattributed).toBeDefined()
  })
})
