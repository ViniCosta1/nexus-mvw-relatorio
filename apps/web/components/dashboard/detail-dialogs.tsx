"use client"

import { ImageSquare, Play } from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { StrategyBadge } from "@/components/dashboard/strategy-badge"
import { formatCurrencyBRL } from "@/lib/format"
import type { AdRankingRow, CampaignPerformanceRow } from "@/lib/queries/overview"

const nf = (n: number) => n.toLocaleString("pt-BR")

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export function CampaignDetailDialog({
  row,
  onOpenChange,
}: {
  row: CampaignPerformanceRow | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      {row && (
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{row.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              <StrategyBadge strategy={row.strategy} />
              <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                {row.status === "ACTIVE" ? "Ativa" : "Pausada"}
              </Badge>
              <span>
                {row.adCount} {row.adCount === 1 ? "criativo" : "criativos"}
              </span>
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label="Investido" value={formatCurrencyBRL(row.spend)} />
            <Metric label="Impressões" value={nf(row.impressions)} />
            <Metric label="Cliques" value={nf(row.clicks)} />
            <Metric label="Alcance" value={nf(row.reach)} />
            <Metric label="CTR" value={`${row.ctr.toFixed(2)}%`} />
            <Metric label="CPC" value={formatCurrencyBRL(row.cpc)} />
            <Metric label="CPM" value={formatCurrencyBRL(row.cpm)} />
          </dl>
        </DialogContent>
      )}
    </Dialog>
  )
}

/** Renders the creative preview: full image for photos, thumbnail + play badge for
 *  videos, or a neutral placeholder when no media URL was captured from Meta/Make. */
function CreativePreview({ row }: { row: AdRankingRow }) {
  const isVideo = row.creativeType?.toUpperCase().includes("VIDEO")
  const src = row.imageUrl ?? row.thumbnailUrl

  if (!src) {
    return (
      <div className="bg-muted text-muted-foreground flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md border">
        <ImageSquare size={32} />
        <p className="text-xs">Prévia indisponível</p>
      </div>
    )
  }

  return (
    <div className="bg-muted relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element -- Meta CDN host is dynamic; plain img avoids next/image domain allow-listing */}
      <img src={src} alt={row.name} loading="lazy" className="h-full w-full object-contain" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play size={22} weight="fill" />
          </div>
        </div>
      )}
    </div>
  )
}

export function AdDetailDialog({
  row,
  onOpenChange,
}: {
  row: AdRankingRow | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      {row && (
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{row.name}</DialogTitle>
            <DialogDescription className="pt-1">
              Campanha: <span className="text-foreground font-medium">{row.campaignName}</span>
              {row.adsetName ? ` · Conjunto: ${row.adsetName}` : ""}
            </DialogDescription>
          </DialogHeader>

          <CreativePreview row={row} />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.creativeType ?? "Tipo não informado"}</Badge>
            {row.permalinkUrl && (
              <a
                href={row.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm underline underline-offset-2"
              >
                Ver anúncio no Meta
              </a>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label="Investido" value={formatCurrencyBRL(row.spend)} />
            <Metric label="Alcance" value={nf(row.reach)} />
            <Metric label="Impressões" value={nf(row.impressions)} />
            <Metric label="Cliques" value={nf(row.clicks)} />
            <Metric label="CTR" value={`${row.ctr.toFixed(2)}%`} />
            <Metric label="CPC" value={formatCurrencyBRL(row.cpc)} />
            <Metric label="CPM" value={formatCurrencyBRL(row.cpm)} />
          </dl>
        </DialogContent>
      )}
    </Dialog>
  )
}
