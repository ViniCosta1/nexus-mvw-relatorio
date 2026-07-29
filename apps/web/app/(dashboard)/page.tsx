import { Suspense } from "react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { HighlightCard } from "@/components/dashboard/highlight-card"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { SpendVsSalesChart } from "@/components/dashboard/spend-vs-sales-chart"
import { CampaignRankingTable, AdRankingTable, SellerRankingTable } from "@/components/dashboard/ranking-table"
import { OverviewSkeleton } from "@/components/dashboard/skeletons"
import { TrafficStartNote } from "@/components/dashboard/traffic-start-note"
import type { KpiInfo } from "@/components/dashboard/info-hint"
import { FilterBar } from "@/components/filters/filter-bar"
import { ACCOUNT_START_DAY } from "@/lib/config"
import { formatCurrencyBRL, formatDateLongBR } from "@/lib/format"
import { buildInsights } from "@/lib/insights"
import {
  resolveRange,
  getKpiSummary,
  getCampaignPerformance,
  getAdRanking,
  getSpendVsSalesSeries,
  getSellerRanking,
  periodRoi,
  type DateRange,
} from "@/lib/queries/overview"

const MIN_IMPRESSIONS_FOR_HIGHLIGHT = 100

const KPI_INFO: Record<string, KpiInfo> = {
  spend: {
    what: "Total gasto em anúncios no Meta (Facebook/Instagram) dentro do período filtrado.",
    example: "Ex.: R$ 2.700 investidos entre 1 e 30 de junho.",
    why: "É o custo da operação de tráfego — base para julgar se as vendas compensam o gasto.",
  },
  impressions: {
    what: "Quantas vezes seus anúncios apareceram na tela das pessoas (conta repetições).",
    example: "Ex.: 100.000 impressões = anúncios exibidos 100 mil vezes, mesmo que para a mesma pessoa mais de uma vez.",
    why: "Mede exposição da marca e é a base do CTR e do CPM.",
  },
  clicks: {
    what: "Total de cliques que os anúncios receberam no período.",
    example: "Ex.: 1.800 cliques somando todas as campanhas.",
    why: "Mostra quanto interesse o anúncio gerou; alimenta o CTR e o CPC.",
  },
  cpc: {
    what: "Custo médio por clique — investido dividido pelos cliques.",
    example: "Ex.: R$ 2.700 ÷ 1.800 cliques = R$ 1,50 por clique.",
    why: "Quanto menor, mais barato atrair cada visitante; serve para comparar a eficiência das campanhas.",
  },
  revenue: {
    what: "Receita bruta dos ingressos pagos (Greenn) no período. Não inclui cortesias.",
    example: "Ex.: R$ 8.369 em ingressos vendidos.",
    why: "É o resultado financeiro das vendas — o que você compara com o investido em anúncios.",
  },
  ticket: {
    what: "Valor médio de cada ingresso pago — receita dividida pelos ingressos pagos.",
    example: "Ex.: R$ 8.369 ÷ 15 pagos = R$ 557 por ingresso.",
    why: "Indica o valor típico de uma venda; ajuda a projetar receita por volume.",
  },
  salesCount: {
    what: "Quantidade total de ingressos emitidos no período (pagos + cortesias).",
    example: "Ex.: 105 ingressos = 15 pagos + 90 cortesias/convidados.",
    why: "Mede o volume do evento; a separação pago vs cortesia fica na aba Vendas & Clientes.",
  },
  roi: {
    what: "Quanto a receita de ingressos superou o investimento em anúncios no mesmo período: (vendido − investido) ÷ investido.",
    example: "Ex.: R$ 8.369 vendidos com R$ 2.700 investidos = +210%.",
    why: "Dá a leitura financeira do período inteiro. Atenção: não há atribuição — nenhuma venda é rastreada até um anúncio específico, então parte dessa receita pode vir de indicação, orgânico ou venda direta. É comparação de período, não retorno provado do anúncio.",
  },
}

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>
}) {
  const params = await searchParams
  const range = resolveRange(params.from, params.to)
  const search = params.q?.trim() || undefined
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
  const fromISO = range.from.toISOString().slice(0, 10)
  const toISO = range.to.toISOString().slice(0, 10)
  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Período selecionado: {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
        <div className="mt-1">
          <TrafficStartNote />
        </div>
      </div>

      <FilterBar from={fromISO} to={toISO} todayISO={todayISO} accountStartDay={ACCOUNT_START_DAY} />

      <Suspense key={`${fromISO}|${toISO}|${search ?? ""}`} fallback={<OverviewSkeleton />}>
        <OverviewContent range={range} search={search} />
      </Suspense>
    </div>
  )
}

async function OverviewContent({ range, search }: { range: DateRange; search?: string }) {
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

  // "Best" is defined by CTR (engagement per impression). Explain the pick by
  // comparing it to the period's average and showing the volume behind it, so
  // it doesn't read as an unexplained trophy.
  const avgCampaignCtr = campaigns.length > 0 ? campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length : 0
  const nf = (n: number) => n.toLocaleString("pt-BR")
  const roi = periodRoi(kpis.totalRevenue, kpis.totalSpend)

  const campaignReason = bestCampaign
    ? `Maior CTR do período: ${bestCampaign.ctr.toFixed(2)}%${
        avgCampaignCtr > 0 && bestCampaign.ctr > avgCampaignCtr
          ? ` — ${(((bestCampaign.ctr - avgCampaignCtr) / avgCampaignCtr) * 100).toFixed(0)}% acima da média das campanhas (${avgCampaignCtr.toFixed(2)}%)`
          : ""
      }. Gerou ${nf(bestCampaign.clicks)} cliques em ${nf(bestCampaign.impressions)} impressões, a ${formatCurrencyBRL(bestCampaign.cpc)} por clique.`
    : undefined

  const adReason = bestAd
    ? `Melhor relação de engajamento: CTR de ${bestAd.ctr.toFixed(2)}% com ${nf(bestAd.clicks)} cliques e alcance de ${nf(bestAd.reach)} pessoas, a um CPM de ${formatCurrencyBRL(bestAd.cpm)}.`
    : undefined

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Investido em anúncios" value={formatCurrencyBRL(kpis.totalSpend)} hint="Meta Ads" info={KPI_INFO.spend} />
        <KpiCard title="Impressões totais" value={nf(kpis.totalImpressions)} hint="Meta Ads" info={KPI_INFO.impressions} />
        <KpiCard title="Cliques totais" value={nf(kpis.totalClicks)} hint="Meta Ads" info={KPI_INFO.clicks} />
        <KpiCard title="CPC médio" value={formatCurrencyBRL(kpis.cpc)} hint="Custo por clique" info={KPI_INFO.cpc} />
        <KpiCard title="Vendido em ingressos" value={formatCurrencyBRL(kpis.totalRevenue)} hint="Greenn (bruto)" info={KPI_INFO.revenue} />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} info={KPI_INFO.ticket} />
        <KpiCard title="Ingressos vendidos" value={String(kpis.salesCount)} info={KPI_INFO.salesCount} />
        <KpiCard
          title="ROI do período"
          value={roi === null ? "—" : `${roi > 0 ? "+" : ""}${roi.toFixed(0)}%`}
          hint={roi === null ? "Sem investimento no período" : "Vendido vs. investido · sem atribuição"}
          info={KPI_INFO.roi}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bestCampaign ? (
          <HighlightCard
            title="Melhor campanha"
            name={bestCampaign.name}
            metric={`CTR ${bestCampaign.ctr.toFixed(2)}% · ${formatCurrencyBRL(bestCampaign.cpc)} por clique`}
            reason={campaignReason}
          />
        ) : null}
        {bestAd ? (
          <HighlightCard
            title="Melhor criativo"
            name={bestAd.name}
            metric={`CTR ${bestAd.ctr.toFixed(2)}% · ${formatCurrencyBRL(bestAd.cpc)} por clique`}
            reason={adReason}
          />
        ) : null}
      </div>

      <InsightsPanel insights={insights} />
      <SpendVsSalesChart data={series} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignRankingTable rows={campaigns} />
        </div>
        <SellerRankingTable rows={sellers} />
      </div>
      <AdRankingTable rows={ads} />
    </>
  )
}
