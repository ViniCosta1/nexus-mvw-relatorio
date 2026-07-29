import { Skeleton } from "@workspace/ui/components/skeleton"

/** Rounded skeleton block; the base Skeleton is square, twMerge lets us round it. */
function Block({ className }: { className?: string }) {
  return <Skeleton className={`rounded-lg ${className ?? ""}`} />
}

/** Loading placeholder for the Visão Geral page (KPIs, highlights, chart, tables). */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <Block className="h-32" />
      <Block className="h-72" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Block className="h-80" />
        <Block className="h-80" />
      </div>
      <Block className="h-96" />
    </div>
  )
}

/** Loading placeholder for the Campanhas page (two tables). */
export function CampaignsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Block className="h-80" />
      <Block className="h-96" />
    </div>
  )
}

/** Loading placeholder for the Vendas page (seller ranking + sales table). */
export function VendasSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Block className="h-64" />
      <Block className="h-96" />
    </div>
  )
}

/** Loading placeholder for the Social page (KPIs, chart, daily table). */
export function SocialSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-28" />
        ))}
      </div>
      <Block className="h-80" />
      <Block className="h-96" />
    </div>
  )
}
