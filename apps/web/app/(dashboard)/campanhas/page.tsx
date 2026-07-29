import { Suspense } from "react"
import { CampaignRankingTable, AdRankingTable, StrategyRankingTable } from "@/components/dashboard/ranking-table"
import { CampaignsSkeleton } from "@/components/dashboard/skeletons"
import { TrafficStartNote } from "@/components/dashboard/traffic-start-note"
import { FilterBar } from "@/components/filters/filter-bar"
import { ACCOUNT_START_DAY } from "@/lib/config"
import { formatDateLongBR } from "@/lib/format"
import {
  resolveRange,
  getCampaignPerformance,
  getFullAdList,
  getStrategyPerformance,
  type DateRange,
} from "@/lib/queries/overview"

export default async function CampanhasPage({
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
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <p className="text-muted-foreground text-sm">
          Dados completos do Meta Ads · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
        <div className="mt-1">
          <TrafficStartNote />
        </div>
      </div>

      <FilterBar from={fromISO} to={toISO} todayISO={todayISO} accountStartDay={ACCOUNT_START_DAY} />

      <Suspense key={`${fromISO}|${toISO}|${search ?? ""}`} fallback={<CampaignsSkeleton />}>
        <CampanhasContent range={range} search={search} />
      </Suspense>
    </div>
  )
}

async function CampanhasContent({ range, search }: { range: DateRange; search?: string }) {
  const [strategies, campaigns, ads] = await Promise.all([
    getStrategyPerformance(range, search),
    getCampaignPerformance(range, search),
    getFullAdList(range, search),
  ])

  return (
    <>
      <StrategyRankingTable rows={strategies} />
      <CampaignRankingTable rows={campaigns} />
      <AdRankingTable rows={ads} title={`Anúncios / Criativos (${ads.length})`} />
    </>
  )
}
