import { KpiCard } from "@/components/dashboard/kpi-card"
import { HighlightCard } from "@/components/dashboard/highlight-card"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { SpendVsSalesChart } from "@/components/dashboard/spend-vs-sales-chart"
import { CampaignRankingTable, AdRankingTable, SellerRankingTable } from "@/components/dashboard/ranking-table"
import { FilterBar } from "@/components/filters/filter-bar"
import { formatCurrencyBRL, formatDateLongBR } from "@/lib/format"
import { buildInsights } from "@/lib/insights"
import {
  getDefaultDateRange,
  getKpiSummary,
  getCampaignPerformance,
  getAdRanking,
  getSpendVsSalesSeries,
  getSellerRanking,
  type DateRange,
} from "@/lib/queries/overview"

function resolveRange(from?: string, to?: string): DateRange {
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T00:00:00.000Z`)
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return { from: fromDate, to: toDate }
    }
  }
  return getDefaultDateRange(30)
}

const MIN_IMPRESSIONS_FOR_HIGHLIGHT = 100

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>
}) {
  const params = await searchParams
  const range = resolveRange(params.from, params.to)
  const search = params.q?.trim() || undefined
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1

  const [kpis, campaigns, ads, series, sellers] = await Promise.all([
    getKpiSummary(range),
    getCampaignPerformance(range, search),
    getAdRanking(range, search),
    getSpendVsSalesSeries(range),
    getSellerRanking(range, search),
  ])

  const insights = buildInsights({
    campaigns: campaigns.map((c) => ({
      campaignId: c.campaignId,
      name: c.name,
      clicks: c.clicks,
      impressions: c.impressions,
      ctr: c.ctr,
      cpc: c.cpc,
    })),
    totalRevenue: kpis.totalRevenue,
    salesCount: kpis.salesCount,
    currentPeriodRevenue: kpis.currentPeriodRevenue,
    previousPeriodRevenue: kpis.previousPeriodRevenue,
  })

  const bestCampaign = [...campaigns]
    .filter((c) => c.impressions >= MIN_IMPRESSIONS_FOR_HIGHLIGHT)
    .sort((a, b) => b.ctr - a.ctr)[0]
  const bestAd = ads.find((ad) => ad.impressions >= MIN_IMPRESSIONS_FOR_HIGHLIGHT) ?? ads[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Período selecionado: {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
      </div>

      <FilterBar activeDays={spanDays} from={range.from.toISOString().slice(0, 10)} to={range.to.toISOString().slice(0, 10)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Investido em anúncios" value={formatCurrencyBRL(kpis.totalSpend)} hint="Meta Ads" />
        <KpiCard title="Vendido em ingressos" value={formatCurrencyBRL(kpis.totalRevenue)} hint="Greenn" />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} />
        <KpiCard title="Ingressos vendidos" value={String(kpis.salesCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bestCampaign ? (
          <HighlightCard
            title="Melhor campanha"
            name={bestCampaign.name}
            metric={`CTR ${bestCampaign.ctr.toFixed(2)}% · ${formatCurrencyBRL(bestCampaign.cpc)} por clique`}
          />
        ) : null}
        {bestAd ? (
          <HighlightCard
            title="Melhor criativo"
            name={bestAd.name}
            metric={`CTR ${bestAd.ctr.toFixed(2)}% · ${formatCurrencyBRL(bestAd.cpc)} por clique`}
          />
        ) : null}
      </div>

      <InsightsPanel insights={insights} />
      <SpendVsSalesChart data={series} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignRankingTable rows={campaigns} />
        <SellerRankingTable rows={sellers} />
      </div>
      <AdRankingTable rows={ads} />
    </div>
  )
}
