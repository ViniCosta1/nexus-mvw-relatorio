import { KpiCard } from "@/components/dashboard/kpi-card"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { SpendVsSalesChart } from "@/components/dashboard/spend-vs-sales-chart"
import { CampaignRankingTable, SellerRankingTable } from "@/components/dashboard/ranking-table"
import { formatCurrencyBRL, formatDateLongBR, formatRoas } from "@/lib/format"
import { buildInsights } from "@/lib/insights"
import { getDefaultDateRange, getKpiSummary, getCampaignRanking, getSpendVsSalesSeries, getSellerRanking } from "@/lib/queries/overview"

export default async function VisaoGeralPage() {
  const range = getDefaultDateRange()
  const [kpis, campaigns, series, sellers] = await Promise.all([
    getKpiSummary(range),
    getCampaignRanking(range),
    getSpendVsSalesSeries(range),
    getSellerRanking(range),
  ])

  const insights = buildInsights({
    campaigns: campaigns.map((c) => ({ campaignId: c.campaignId, name: c.name, spend: c.spend, revenue: c.revenue })),
    unattributedRevenue: kpis.unattributedRevenue,
    totalRevenue: kpis.totalRevenue,
    currentPeriodRevenue: kpis.currentPeriodRevenue,
    previousPeriodRevenue: kpis.previousPeriodRevenue,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Últimos 30 dias · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Investido" value={formatCurrencyBRL(kpis.totalSpend)} />
        <KpiCard title="Vendido" value={formatCurrencyBRL(kpis.totalRevenue)} />
        <KpiCard title="ROAS" value={formatRoas(kpis.roas)} hint="retorno por real investido" />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} />
        <KpiCard title="Vendas" value={String(kpis.salesCount)} />
      </div>
      <InsightsPanel insights={insights} />
      <SpendVsSalesChart data={series} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignRankingTable rows={campaigns} />
        <SellerRankingTable rows={sellers} />
      </div>
    </div>
  )
}
