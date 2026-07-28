import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrencyBRL } from "@/lib/format"
import type { AdRankingRow, CampaignPerformanceRow, SellerRankingRow } from "@/lib/queries/overview"

export function CampaignRankingTable({ rows }: { rows: CampaignPerformanceRow[] }) {
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
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.campaignId}>
                  <TableCell className="max-w-64 truncate font-medium" title={row.name}>
                    {row.name}
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
    </Card>
  )
}

export function AdRankingTable({ rows, title = "Criativos — qual anúncio performou mais" }: { rows: AdRankingRow[]; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum criativo com dado no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criativo</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPC</TableHead>
                <TableHead className="text-right">CPM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.adId}>
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
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum vendedor com venda no período.</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  )
}
