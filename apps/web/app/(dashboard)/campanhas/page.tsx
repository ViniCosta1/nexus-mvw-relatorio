import { CampaignRankingTable, AdRankingTable } from "@/components/dashboard/ranking-table"
import { FilterBar } from "@/components/filters/filter-bar"
import { formatDateLongBR } from "@/lib/format"
import { getDefaultDateRange, getCampaignPerformance, getFullAdList, type DateRange } from "@/lib/queries/overview"

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

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>
}) {
  const params = await searchParams
  const range = resolveRange(params.from, params.to)
  const search = params.q?.trim() || undefined
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1

  const [campaigns, ads] = await Promise.all([
    getCampaignPerformance(range, search),
    getFullAdList(range, search),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Campanhas</h1>
        <p className="text-muted-foreground text-sm">
          Dados completos do Meta Ads · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
      </div>

      <FilterBar
        activeDays={spanDays}
        from={range.from.toISOString().slice(0, 10)}
        to={range.to.toISOString().slice(0, 10)}
      />

      <CampaignRankingTable rows={campaigns} />
      <AdRankingTable rows={ads} title={`Anúncios / Criativos (${ads.length})`} />
    </div>
  )
}
