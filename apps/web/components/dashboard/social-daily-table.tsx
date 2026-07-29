import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import type { SocialDailyRow } from "@/lib/queries/social"
import { formatDateLongBR } from "@/lib/format"

const nf = (n: number) => n.toLocaleString("pt-BR")
/** Follower balance is signed: "+12" and "-3" read very differently from "12" and "3". */
const signed = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`

export function SocialDailyTable({ rows }: { rows: SocialDailyRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dia a dia ({rows.length} dias)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
              <TableHead className="text-right">Visualizações</TableHead>
              <TableHead className="text-right">Interações</TableHead>
              <TableHead className="text-right">Contas engajadas</TableHead>
              <TableHead className="text-right">Curtidas</TableHead>
              <TableHead className="text-right">Comentários</TableHead>
              <TableHead className="text-right">Salvos</TableHead>
              <TableHead className="text-right">Compart.</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="whitespace-nowrap">{formatDateLongBR(`${row.date}T00:00:00.000Z`)}</TableCell>
                <TableCell className="text-right">{nf(row.reach)}</TableCell>
                <TableCell className="text-right">{nf(row.views)}</TableCell>
                <TableCell className="text-right">{nf(row.totalInteractions)}</TableCell>
                <TableCell className="text-right">{nf(row.accountsEngaged)}</TableCell>
                <TableCell className="text-right">{nf(row.likes)}</TableCell>
                <TableCell className="text-right">{nf(row.comments)}</TableCell>
                <TableCell className="text-right">{nf(row.saves)}</TableCell>
                <TableCell className="text-right">{nf(row.shares)}</TableCell>
                <TableCell className="text-right">{signed(row.followsNet)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
