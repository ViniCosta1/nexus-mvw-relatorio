"use client"

import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatMonthBR } from "@/lib/format"
import { filterGroupsByMonth, type DeliveryMonthGroup } from "@/lib/queries/production"

const nf = (n: number) => n.toLocaleString("pt-BR")

const KIND_LABEL: Record<string, string> = { ARTE: "Arte", VIDEO: "Vídeo", MARCO: "Marco" }

/**
 * One card per month instead of a single table with the month repeated on every
 * row: the months are separate deliveries, not a continuous series, and reading
 * them side by side was the whole point. The filter narrows to a single month
 * without hiding that the others exist.
 */
export function ProductionByMonth({ groups }: { groups: DeliveryMonthGroup[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const visible = filterGroupsByMonth(groups, selected)

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma peça contabilizada por mês.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-base font-semibold">Produções por mês</h2>
        <Button
          type="button"
          size="sm"
          variant={selected === null ? "default" : "outline"}
          onClick={() => setSelected(null)}
        >
          Todos
        </Button>
        {groups.map((group) => (
          <Button
            key={group.month}
            type="button"
            size="sm"
            variant={selected === group.month ? "default" : "outline"}
            className="capitalize"
            onClick={() => setSelected(group.month)}
          >
            {formatMonthBR(group.month)}
          </Button>
        ))}
      </div>

      <div className={visible.length > 1 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {visible.map((group) => (
          <Card key={group.month}>
            <CardHeader className="gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base capitalize">{formatMonthBR(group.month)}</CardTitle>
              <span className="text-muted-foreground text-sm">
                {nf(group.total)} {group.total === 1 ? "peça" : "peças"}
              </span>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{nf(item.quantity ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-medium">Total do mês</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-medium">{nf(group.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
