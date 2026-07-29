"use client"

import { useMemo, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { SortHeader, useSortedRows } from "@/components/dashboard/sortable"
import { formatCurrencyBRL, formatMonthBR } from "@/lib/format"
import type { CostRow } from "@/lib/queries/costs"

/** "junho de 2026" for a one-off, "desde junho de 2026" while it keeps running. */
function validity(row: CostRow): string {
  if (row.endMonth === null) return `desde ${formatMonthBR(row.startMonth)}`
  if (row.endMonth === row.startMonth) return formatMonthBR(row.startMonth)
  return `${formatMonthBR(row.startMonth)} – ${formatMonthBR(row.endMonth)}`
}

export function CostsTable({ rows }: { rows: CostRow[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return rows
    return rows.filter((r) => {
      const haystack = `${r.name} ${r.category} ${r.note ?? ""}`.toLowerCase()
      return tokens.every((t) => haystack.includes(t))
    })
  }, [rows, query])
  const { sorted, sort, onSort } = useSortedRows(filtered)

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Custos — item a item</CardTitle>
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            size={16}
          />
          <Input
            placeholder="Filtrar por item ou categoria..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum custo cadastrado.</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum resultado para “{query}”.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader<CostRow> label="Item" sortKey="name" sort={sort} onSort={onSort} />
                <SortHeader<CostRow> label="Categoria" sortKey="category" sort={sort} onSort={onSort} />
                <SortHeader<CostRow> label="Tipo" sortKey="kind" sort={sort} onSort={onSort} />
                <SortHeader<CostRow> label="Vigência" sortKey="startMonth" sort={sort} onSort={onSort} />
                <SortHeader<CostRow> label="Valor" sortKey="amount" sort={sort} onSort={onSort} align="right" />
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.name}
                    {row.hasVariable ? (
                      <span className="text-muted-foreground ml-1 text-xs">+ comissão</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>
                    <Badge variant={row.kind === "MONTHLY" ? "default" : "secondary"}>
                      {row.kind === "MONTHLY" ? "Mensal" : "Pontual"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{validity(row)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrencyBRL(row.amount)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-72 text-xs">{row.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function CostsByMonthTable({ rows }: { rows: { month: string; total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custo por mês</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="capitalize">{formatMonthBR(row.month)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrencyBRL(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
