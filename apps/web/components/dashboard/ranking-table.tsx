"use client"

import { useMemo, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { AdDetailDialog, CampaignDetailDialog } from "@/components/dashboard/detail-dialogs"
import { DeliveryBadge } from "@/components/dashboard/delivery-badge"
import { SortHeader, useSortedRows } from "@/components/dashboard/sortable"
import { StrategyBadge } from "@/components/dashboard/strategy-badge"
import { formatCurrencyBRL } from "@/lib/format"
import type {
  AdRankingRow,
  CampaignPerformanceRow,
  SellerRankingRow,
  StrategyPerformanceRow,
} from "@/lib/queries/overview"

export function CampaignRankingTable({ rows }: { rows: CampaignPerformanceRow[] }) {
  const { sorted, sort, onSort } = useSortedRows(rows)
  const [selected, setSelected] = useState<CampaignPerformanceRow | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campanhas — performance de investimento</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma campanha com dado no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader<CampaignPerformanceRow> label="Campanha" sortKey="name" sort={sort} onSort={onSort} />
                <SortHeader<CampaignPerformanceRow> label="Estratégia" sortKey="strategy" sort={sort} onSort={onSort} />
                <SortHeader<CampaignPerformanceRow> label="Veiculação" sortKey="delivery" sort={sort} onSort={onSort} />
                <SortHeader<CampaignPerformanceRow> label="Investido" sortKey="spend" sort={sort} onSort={onSort} align="right" />
                <SortHeader<CampaignPerformanceRow> label="Impressões" sortKey="impressions" sort={sort} onSort={onSort} align="right" />
                <SortHeader<CampaignPerformanceRow> label="Cliques" sortKey="clicks" sort={sort} onSort={onSort} align="right" />
                <SortHeader<CampaignPerformanceRow> label="CTR" sortKey="ctr" sort={sort} onSort={onSort} align="right" />
                <SortHeader<CampaignPerformanceRow> label="CPC" sortKey="cpc" sort={sort} onSort={onSort} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow
                  key={row.campaignId}
                  onClick={() => setSelected(row)}
                  className="hover:bg-muted/50 cursor-pointer"
                >
                  <TableCell className="max-w-64 truncate font-medium" title={row.name}>
                    {row.name}
                  </TableCell>
                  <TableCell>
                    <StrategyBadge strategy={row.strategy} />
                  </TableCell>
                  <TableCell>
                    <DeliveryBadge state={row.delivery} lastDay={row.lastDeliveryDay} />
                  </TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.spend)}</TableCell>
                  <TableCell className="text-right">{row.impressions.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.clicks.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.cpc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CampaignDetailDialog row={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </Card>
  )
}

export function AdRankingTable({
  rows,
  title = "Criativos — qual anúncio performou mais",
}: {
  rows: AdRankingRow[]
  title?: string
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<AdRankingRow | null>(null)
  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return rows
    return rows.filter((r) => {
      const haystack = `${r.name} ${r.campaignName}`.toLowerCase()
      return tokens.every((t) => haystack.includes(t))
    })
  }, [rows, query])
  const { sorted, sort, onSort } = useSortedRows(filtered)

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            size={16}
          />
          <Input
            placeholder="Filtrar por criativo ou campanha..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum criativo com dado no período.</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum resultado para “{query}”.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader<AdRankingRow> label="Criativo" sortKey="name" sort={sort} onSort={onSort} />
                <SortHeader<AdRankingRow> label="Campanha" sortKey="campaignName" sort={sort} onSort={onSort} />
                <SortHeader<AdRankingRow> label="Investido" sortKey="spend" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="Alcance" sortKey="reach" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="Impressões" sortKey="impressions" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="Cliques" sortKey="clicks" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="CTR" sortKey="ctr" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="CPC" sortKey="cpc" sort={sort} onSort={onSort} align="right" />
                <SortHeader<AdRankingRow> label="CPM" sortKey="cpm" sort={sort} onSort={onSort} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow
                  key={row.adId}
                  onClick={() => setSelected(row)}
                  className="hover:bg-muted/50 cursor-pointer"
                >
                  <TableCell className="max-w-48 truncate font-medium" title={row.name}>
                    {row.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate text-sm" title={row.campaignName}>
                    {row.campaignName}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.spend)}</TableCell>
                  <TableCell className="text-right">{row.reach.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.impressions.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.clicks.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.cpc)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.cpm)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AdDetailDialog row={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </Card>
  )
}

export function StrategyRankingTable({ rows }: { rows: StrategyPerformanceRow[] }) {
  const { sorted, sort, onSort } = useSortedRows(rows)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estratégias — ranking por investimento</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma estratégia com dado no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader<StrategyPerformanceRow> label="Estratégia" sortKey="strategy" sort={sort} onSort={onSort} />
                <SortHeader<StrategyPerformanceRow> label="Campanhas" sortKey="campaignCount" sort={sort} onSort={onSort} align="right" />
                <SortHeader<StrategyPerformanceRow> label="Investido" sortKey="spend" sort={sort} onSort={onSort} align="right" />
                <SortHeader<StrategyPerformanceRow> label="Impressões" sortKey="impressions" sort={sort} onSort={onSort} align="right" />
                <SortHeader<StrategyPerformanceRow> label="Cliques" sortKey="clicks" sort={sort} onSort={onSort} align="right" />
                <SortHeader<StrategyPerformanceRow> label="CTR" sortKey="ctr" sort={sort} onSort={onSort} align="right" />
                <SortHeader<StrategyPerformanceRow> label="CPC" sortKey="cpc" sort={sort} onSort={onSort} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.strategy}>
                  <TableCell>
                    <StrategyBadge strategy={row.strategy} />
                  </TableCell>
                  <TableCell className="text-right">{row.campaignCount}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrencyBRL(row.spend)}</TableCell>
                  <TableCell className="text-right">{row.impressions.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.clicks.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.cpc)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function SellerRankingTable({ rows }: { rows: SellerRankingRow[] }) {
  const { sorted, sort, onSort } = useSortedRows(rows)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendedores — quem vendeu mais</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum vendedor com venda no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader<SellerRankingRow> label="Vendedor" sortKey="sellerName" sort={sort} onSort={onSort} />
                <SortHeader<SellerRankingRow> label="Vendido" sortKey="revenue" sort={sort} onSort={onSort} align="right" />
                <SortHeader<SellerRankingRow> label="Vendas" sortKey="salesCount" sort={sort} onSort={onSort} align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.sellerName}>
                  <TableCell className="font-medium">{row.sellerName}</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(row.revenue)}</TableCell>
                  <TableCell className="text-right">{row.salesCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
