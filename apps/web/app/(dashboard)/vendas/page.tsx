import { Suspense } from "react"
import { SalesTable } from "@/components/dashboard/sales-table"
import { SellerRankingTable } from "@/components/dashboard/ranking-table"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { HighlightCard } from "@/components/dashboard/highlight-card"
import { VendasSkeleton } from "@/components/dashboard/skeletons"
import { TrafficStartNote } from "@/components/dashboard/traffic-start-note"
import { FilterBar } from "@/components/filters/filter-bar"
import { ACCOUNT_START_DAY } from "@/lib/config"
import { formatCurrencyBRL, formatDateLongBR } from "@/lib/format"
import {
  resolveRange,
  getSalesList,
  getSalesHighlights,
  getSellerRanking,
  type DateRange,
} from "@/lib/queries/overview"

export default async function VendasPage({
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
        <h1 className="text-2xl font-semibold">Vendas &amp; Clientes</h1>
        <p className="text-muted-foreground text-sm">
          Dados completos da Greenn · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
        <div className="mt-1">
          <TrafficStartNote />
        </div>
      </div>

      <FilterBar from={fromISO} to={toISO} todayISO={todayISO} accountStartDay={ACCOUNT_START_DAY} />

      <Suspense key={`${fromISO}|${toISO}|${search ?? ""}`} fallback={<VendasSkeleton />}>
        <VendasContent range={range} search={search} />
      </Suspense>
    </div>
  )
}

async function VendasContent({ range, search }: { range: DateRange; search?: string }) {
  const [sales, sellers, highlights] = await Promise.all([
    getSalesList(range, search),
    getSellerRanking(range, search),
    getSalesHighlights(range, search),
  ])

  const nf = (n: number) => n.toLocaleString("pt-BR")
  const paidCount = highlights.salesCount - highlights.freeCount
  const pct = (n: number) => (highlights.salesCount > 0 ? Math.round((n / highlights.salesCount) * 100) : 0)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total vendido" value={formatCurrencyBRL(highlights.revenue)} hint="Greenn" />
        <KpiCard
          title="Ingressos pagos"
          value={nf(paidCount)}
          hint={`de ${nf(highlights.salesCount)} emitidos · ${pct(paidCount)}%`}
        />
        <KpiCard
          title="Cortesias / convidados"
          value={nf(highlights.freeCount)}
          hint={`de ${nf(highlights.salesCount)} emitidos · ${pct(highlights.freeCount)}%`}
        />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(highlights.avgTicket)} hint="Sobre ingressos pagos" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.topChannel ? (
          <HighlightCard
            title="Canal com mais vendas"
            name={highlights.topChannel.label}
            metric={`${nf(highlights.topChannel.salesCount)} vendas`}
            reason={`Lidera em volume no período, com ${formatCurrencyBRL(highlights.topChannel.revenue)} em receita.`}
          />
        ) : null}
        {highlights.topProductPaid ? (
          <HighlightCard
            title="Produto pago mais vendido"
            name={highlights.topProductPaid.label}
            metric={`${nf(highlights.topProductPaid.salesCount)} vendas`}
            reason={`Ingresso pago mais vendido, somando ${formatCurrencyBRL(highlights.topProductPaid.revenue)} em receita.`}
          />
        ) : null}
        {highlights.topProductFree ? (
          <HighlightCard
            title="Convidado mais frequente"
            name={highlights.topProductFree.label}
            metric={`${nf(highlights.topProductFree.salesCount)} cortesias`}
            reason="Ingresso de convidado/cortesia (R$ 0,00) mais emitido do período."
          />
        ) : null}
        {highlights.topSeller ? (
          <HighlightCard
            title="Vendedor destaque"
            name={highlights.topSeller.label}
            metric={`${nf(highlights.topSeller.salesCount)} vendas`}
            reason={`Maior número de vendas, totalizando ${formatCurrencyBRL(highlights.topSeller.revenue)}.`}
          />
        ) : null}
      </div>

      <SellerRankingTable rows={sellers} />
      <SalesTable rows={sales} />
    </>
  )
}
