import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrencyBRL, formatDateBR } from "@/lib/format"
import type { SaleRow } from "@/lib/queries/overview"

export function SalesTable({ rows }: { rows: SaleRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendas — dados completos ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma venda no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Canal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatDateBR(row.saleDate)}</TableCell>
                  <TableCell className="max-w-40 truncate font-medium" title={row.clientName}>
                    {row.clientName}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-52 truncate text-sm">
                    {row.clientEmail ?? row.clientPhone ?? "—"}
                  </TableCell>
                  <TableCell>{row.sellerName}</TableCell>
                  <TableCell className="max-w-56 truncate" title={row.productName}>
                    {row.productName}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {row.amount > 0 ? formatCurrencyBRL(row.amount) : "Gratuito"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.channel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
