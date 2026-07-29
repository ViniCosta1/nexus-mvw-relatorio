import { Suspense } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { SocialChart } from "@/components/dashboard/social-chart"
import { SocialCollectionNote } from "@/components/dashboard/social-collection-note"
import { SocialDailyTable } from "@/components/dashboard/social-daily-table"
import { SocialSkeleton } from "@/components/dashboard/skeletons"
import type { KpiInfo } from "@/components/dashboard/info-hint"
import { FilterBar } from "@/components/filters/filter-bar"
import { formatDateFullBR, formatDateLongBR } from "@/lib/format"
import { SOCIAL_COLLECTION_START_DATE } from "@/lib/config"
import { buildSocialSeries, getSocialDaily, getSocialSummary } from "@/lib/queries/social"
import { resolveRange, type DateRange } from "@/lib/queries/overview"

const KPI_INFO: Record<string, KpiInfo> = {
  followers: {
    what: "Saldo de seguidores no período: quem começou a seguir menos quem deixou de seguir.",
    example: "Ex.: 120 novos seguidores e 18 saídas no mês = +102.",
    why: "Mostra se o perfil está crescendo de verdade, não só atraindo e perdendo gente.",
  },
  reach: {
    what: "Contas únicas alcançadas pelo perfil no período (não conta a mesma pessoa duas vezes).",
    example: "Ex.: 8.400 contas viram algum conteúdo do perfil em junho.",
    why: "Mede o tamanho real da audiência atingida pelo conteúdo orgânico.",
  },
  views: {
    what: "Total de visualizações do conteúdo do perfil, contando repetições.",
    example: "Ex.: 23.000 visualizações somando feed, reels e stories.",
    why: "Mede volume de exibição; comparado ao alcance, indica quanto cada pessoa vê em média.",
  },
  interactions: {
    what: "Soma de curtidas, comentários, salvamentos e compartilhamentos no período.",
    example: "Ex.: 1.250 interações no mês.",
    why: "É o sinal de que o conteúdo mobilizou quem viu, não só apareceu.",
  },
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  // No clamp: the 2026-06-01 floor governs Meta Ads spend under a prior agency,
  // not organic Instagram activity.
  const range = resolveRange(params.from, params.to, { clamp: false })
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
  const fromISO = range.from.toISOString().slice(0, 10)
  const toISO = range.to.toISOString().slice(0, 10)
  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="text-muted-foreground text-sm">
          Instagram orgânico · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
        <div className="mt-1">
          <SocialCollectionNote />
        </div>
      </div>

      {/* No accountStartDay: the 2026-06-01 floor is a Meta Ads rule. No search:
          nothing on this page is searchable. */}
      <FilterBar from={fromISO} to={toISO} todayISO={todayISO} showSearch={false} />

      <Suspense key={`${fromISO}|${toISO}`} fallback={<SocialSkeleton />}>
        <SocialContent range={range} />
      </Suspense>
    </div>
  )
}

async function SocialContent({ range }: { range: DateRange }) {
  const [summary, daily] = await Promise.all([getSocialSummary(range), getSocialDaily(range)])

  if (daily.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhum dado de Instagram neste período. A coleta diária começou em{" "}
          {formatDateFullBR(SOCIAL_COLLECTION_START_DATE)} — se o período selecionado já passou dessa data, verifique se
          o cenário do Make rodou.
        </CardContent>
      </Card>
    )
  }

  const { current, previous } = summary
  const nf = (n: number) => n.toLocaleString("pt-BR")
  const signed = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`

  /** "12% vs. período anterior" — omitted when the previous window had nothing to compare against. */
  const delta = (now: number, before: number) =>
    before === 0 ? undefined : `${now >= before ? "+" : ""}${(((now - before) / before) * 100).toFixed(0)}% vs. período anterior`

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Seguidores ganhos"
          value={signed(current.followsNet)}
          hint={`${nf(current.follows)} novos · ${nf(current.unfollows)} saíram`}
          info={KPI_INFO.followers}
        />
        <KpiCard
          title="Alcance"
          value={nf(current.reach)}
          hint={delta(current.reach, previous.reach)}
          info={KPI_INFO.reach}
        />
        <KpiCard
          title="Visualizações"
          value={nf(current.views)}
          hint={delta(current.views, previous.views)}
          info={KPI_INFO.views}
        />
        <KpiCard
          title="Interações"
          value={nf(current.totalInteractions)}
          hint={delta(current.totalInteractions, previous.totalInteractions)}
          info={KPI_INFO.interactions}
        />
      </div>

      <SocialChart data={buildSocialSeries(daily, range)} />
      <SocialDailyTable rows={daily} />
    </>
  )
}
