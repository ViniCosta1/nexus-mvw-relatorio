import { KpiCard } from "@/components/dashboard/kpi-card"
import { formatCurrencyBRL, formatRoas } from "@/lib/format"
import { getDefaultDateRange, getKpiSummary } from "@/lib/queries/overview"

export default async function VisaoGeralPage() {
  const range = getDefaultDateRange()
  const kpis = await getKpiSummary(range)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Últimos 30 dias · {range.from.toLocaleDateString("pt-BR")} – {range.to.toLocaleDateString("pt-BR")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Investido" value={formatCurrencyBRL(kpis.totalSpend)} />
        <KpiCard title="Vendido" value={formatCurrencyBRL(kpis.totalRevenue)} />
        <KpiCard title="ROAS" value={formatRoas(kpis.roas)} hint="retorno por real investido" />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} />
        <KpiCard title="Vendas" value={String(kpis.salesCount)} />
      </div>
    </div>
  )
}
