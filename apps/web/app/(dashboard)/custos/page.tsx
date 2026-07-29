import { Suspense } from "react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { CostsByMonthTable, CostsTable } from "@/components/dashboard/costs-table"
import { VendasSkeleton } from "@/components/dashboard/skeletons"
import type { KpiInfo } from "@/components/dashboard/info-hint"
import { formatCurrencyBRL, formatMonthBR } from "@/lib/format"
import {
  buildMonthTotals,
  getCosts,
  recurringMonthlyTotal,
  totalForMonth,
  type CostRow,
} from "@/lib/queries/costs"

const KPI_INFO: Record<string, KpiInfo> = {
  recurring: {
    what: "Soma dos custos que se repetem todo mês, no mês atual.",
    example: "Ex.: equipe + ferramentas = R$ 13.509 por mês.",
    why: "É o custo fixo de manter a operação rodando — o piso que precisa ser coberto todo mês.",
  },
  currentMonth: {
    what: "Tudo que foi cobrado no mês atual, somando os recorrentes e os pontuais.",
    example: "Ex.: em junho, os R$ 13.509 recorrentes mais R$ 1.065 de itens pontuais.",
    why: "Mostra o desembolso real do mês, que só coincide com o recorrente quando não houve cobrança avulsa.",
  },
  accumulated: {
    what: "Soma de todos os meses desde o início da operação até o mês atual.",
    example: "Ex.: junho + julho.",
    why: "Dá o custo total já comprometido no período de gestão.",
  },
  variable: {
    what: "Itens com uma parte variável (comissão) sem valor fixo cadastrado.",
    example: "Ex.: Karol SS tem R$ 1.500 fixos mais comissão.",
    why: "Os totais desta página contam só a parte fixa — este número lembra quantos itens têm valor a mais não contabilizado.",
  },
}

export default async function CustosPage() {
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Custos</h1>
        <p className="text-muted-foreground text-sm">
          Custos operacionais da gestão · mês de referência: <span className="capitalize">{formatMonthBR(currentMonth)}</span>
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Valores lançados manualmente — não há integração de cobrança. Nada aqui é cruzado com investimento em
          anúncios nem com vendas.
        </p>
      </div>

      <Suspense fallback={<VendasSkeleton />}>
        <CostsContent currentMonth={currentMonth} />
      </Suspense>
    </div>
  )
}

async function CostsContent({ currentMonth }: { currentMonth: string }) {
  const costs = await getCosts()

  if (costs.length === 0) {
    return <CostsTable rows={[]} />
  }

  const monthTotals = buildMonthTotals(costs, currentMonth)
  const accumulated = monthTotals.reduce((sum, m) => sum + m.total, 0)
  const variableItems = costs.filter((c: CostRow) => c.hasVariable)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Custo mensal recorrente"
          value={formatCurrencyBRL(recurringMonthlyTotal(costs, currentMonth))}
          hint="Só o que se repete todo mês"
          info={KPI_INFO.recurring}
        />
        <KpiCard
          title="Custo do mês atual"
          value={formatCurrencyBRL(totalForMonth(costs, currentMonth))}
          hint="Recorrentes + pontuais"
          info={KPI_INFO.currentMonth}
        />
        <KpiCard
          title="Acumulado no período"
          value={formatCurrencyBRL(accumulated)}
          hint={`${monthTotals.length} ${monthTotals.length === 1 ? "mês" : "meses"}`}
          info={KPI_INFO.accumulated}
        />
        <KpiCard
          title="Itens com variável"
          value={String(variableItems.length)}
          hint={
            variableItems.length > 0
              ? `${variableItems.map((c) => c.name).join(", ")} — comissão fora do total`
              : "Nenhum"
          }
          info={KPI_INFO.variable}
        />
      </div>

      <CostsTable rows={costs} />
      <CostsByMonthTable rows={monthTotals} />
    </>
  )
}
