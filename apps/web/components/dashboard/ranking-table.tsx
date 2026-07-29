"use client"

import { useMemo, useState } from "react"
import { CaretDown, CaretUp, CaretUpDown, MagnifyingGlass } from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { AdDetailDialog, CampaignDetailDialog } from "@/components/dashboard/detail-dialogs"
import { StrategyBadge } from "@/components/dashboard/strategy-badge"
import { formatCurrencyBRL } from "@/lib/format"
import type {
  AdRankingRow,
  CampaignPerformanceRow,
  SellerRankingRow,
  StrategyPerformanceRow,
} from "@/lib/queries/overview"

type SortState<T> = { key: keyof T; dir: "asc" | "desc" } | null

/** Client-side sort over already-loaded rows; first click on a column sorts descending. */
function useSortedRows<T>(rows: T[]) {
  const [sort, setSort] = useState<SortState<T>>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const { key, dir } = sort
    return [...rows].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      const c =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR")
      return dir === "asc" ? c : -c
    })
  }, [rows, sort])
  const onSort = (key: keyof T) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
  return { sorted, sort, onSort }
}

function SortHeader<T>({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string
  sortKey: keyof T
  sort: SortState<T>
  onSort: (key: keyof T) => void
  align?: "right"
}) {
  const active = sort?.key === sortKey
  const Icon = !active ? CaretUpDown : sort!.dir === "asc" ? CaretUp : CaretDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 select-none",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon size={12} weight="bold" className={cn("shrink-0", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  )
}

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
                <SortHeader<CampaignPerformanceRow> label="Status" sortKey="status" sort={sort} onSort={onSort} />
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
                    <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                      {row.status === "ACTIVE" ? "Ativa" : "Pausada"}
                    </Badge>
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
