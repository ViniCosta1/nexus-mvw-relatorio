import { Suspense } from "react"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProductionByMonth } from "@/components/dashboard/production-by-month"
import { VendasSkeleton } from "@/components/dashboard/skeletons"
import type { KpiInfo } from "@/components/dashboard/info-hint"
import { getDeliveries, groupDeliveriesByMonth, sumDeliveries } from "@/lib/queries/production"

const KPI_INFO: Record<string, KpiInfo> = {
  artes: {
    what: "Total de artes estáticas entregues no período de gestão.",
    example: "Ex.: 47 em junho e 151 em julho.",
    why: "Mede o volume de produção visual entregue, independente de anúncio ou venda.",
  },
  videos: {
    what: "Total de vídeos entregues no período de gestão.",
    example: "Ex.: 5 em junho e 15 em julho.",
    why: "Vídeo tem custo de produção diferente de arte estática, por isso conta separado.",
  },
  total: {
    what: "Soma de artes e vídeos entregues.",
    example: "Ex.: 198 artes + 20 vídeos = 218 produções.",
    why: "Volume total de produção no período.",
  },
}

export default async function ProducaoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Produção</h1>
        <p className="text-muted-foreground text-sm">Entregas de design e desenvolvimento da gestão</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Contagem de entregas, lançada manualmente.
        </p>
      </div>

      <Suspense fallback={<VendasSkeleton />}>
        <ProducaoContent />
      </Suspense>
    </div>
  )
}

async function ProducaoContent() {
  const deliveries = await getDeliveries()
  const totals = sumDeliveries(deliveries)
  const groups = groupDeliveriesByMonth(deliveries)
  const milestones = deliveries.filter((d) => d.kind === "MARCO")
  const nf = (n: number) => n.toLocaleString("pt-BR")

  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma entrega cadastrada.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard title="Artes" value={nf(totals.artes)} hint="Artes estáticas" info={KPI_INFO.artes} />
        <KpiCard title="Vídeos" value={nf(totals.videos)} hint="Vídeos" info={KPI_INFO.videos} />
        <KpiCard title="Total Produzido" value={nf(totals.total)} hint="Artes + vídeos" info={KPI_INFO.total} />
      </div>

      {milestones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entregas estruturais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {milestones.map((m) => (
              <div key={m.key} className="flex items-center gap-2 text-sm">
                <CheckCircle size={18} weight="fill" className="text-primary shrink-0" />
                {m.label}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ProductionByMonth groups={groups} />
    </>
  )
}
