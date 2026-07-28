import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrencyBRL, formatRoas } from "@/lib/format"
import type { CampaignRankingRow, SellerRankingRow } from "@/lib/queries/overview"

export function CampaignRankingTable({ rows }: { rows: CampaignRankingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campanhas — quem performou mais</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.campaignId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                    {row.status === "ACTIVE" ? "Ativa" : "Pausada"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.spend)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.revenue)}</TableCell>
                <TableCell className="text-right">{formatRoas(row.roas)}</TableCell>
                <TableCell className="text-right">{row.salesCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function SellerRankingTable({ rows }: { rows: SellerRankingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendedores — quem vendeu mais</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sellerName}>
                <TableCell className="font-medium">{row.sellerName}</TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.revenue)}</TableCell>
                <TableCell className="text-right">{row.salesCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
