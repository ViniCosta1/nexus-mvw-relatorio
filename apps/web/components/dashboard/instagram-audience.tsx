"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import type { AgeGenderRow, AudienceShare } from "@/lib/instagram-csv"

const pf = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`

/** Recharts hands label formatters a loose value type; normalise it here. */
const labelPercent = (value: unknown) => pf(Number(value) || 0)

/**
 * Two categorical series need hues that survive colour-vision deficiency, and
 * the theme only carries one hue. The violet is the validated partner for the
 * brand green (adjacent-pair ΔE 32.5 deutan / 18.1 tritan, both above the 8
 * floor); every bar is also directly labelled, so identity never rests on
 * colour alone.
 */
const GENDER_COLORS = { homens: "var(--color-chart-1)", mulheres: "#6a5acd" }

function ShareChart({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: AudienceShare[]
}) {
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-muted-foreground text-xs">{subtitle}</span>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
            <XAxis type="number" tickFormatter={(v: number) => pf(v)} className="text-xs" />
            <YAxis type="category" dataKey="label" width={130} className="text-xs" tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => [pf(typeof value === "number" ? value : 0), "Participação"]} />
            <Bar
              dataKey="percent"
              fill="var(--color-chart-1)"
              radius={[0, 4, 4, 0]}
              label={{ position: "right", fontSize: 11, formatter: labelPercent }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function AgeGenderChart({ rows }: { rows: AgeGenderRow[] }) {
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Faixa etária e gênero</CardTitle>
        <span className="text-muted-foreground text-xs">Participação dos seguidores, em %</span>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 8, right: 8, top: 16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="range" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v: number) => pf(v)} width={50} className="text-xs" />
            <Tooltip formatter={(value) => pf(typeof value === "number" ? value : 0)} />
            <Legend />
            <Bar dataKey="homens" name="Homens" fill={GENDER_COLORS.homens} radius={[4, 4, 0, 0]} />
            <Bar dataKey="mulheres" name="Mulheres" fill={GENDER_COLORS.mulheres} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/** The same shares as the charts, for anyone who can't read them by colour. */
function AgeGenderTable({ rows }: { rows: AgeGenderRow[] }) {
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Faixa etária e gênero — números</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa</TableHead>
              <TableHead className="text-right">Homens</TableHead>
              <TableHead className="text-right">Mulheres</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.range}>
                <TableCell className="font-medium">{row.range}</TableCell>
                <TableCell className="text-right">{pf(row.homens)}</TableCell>
                <TableCell className="text-right">{pf(row.mulheres)}</TableCell>
                <TableCell className="text-right font-medium">
                  {pf(Math.round((row.homens + row.mulheres) * 10) / 10)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function InstagramAudience({
  cities,
  countries,
  ageGender,
}: {
  cities: AudienceShare[]
  countries: AudienceShare[]
  ageGender: AgeGenderRow[]
}) {
  if (cities.length === 0 && countries.length === 0 && ageGender.length === 0) return null

  const topCity = cities[0]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Público</h2>
        <p className="text-muted-foreground text-sm">
          Onde os seguidores estão e quem são. Percentuais do total de seguidores — a soma não fecha 100% porque o
          Instagram só exporta as dez primeiras posições.
          {topCity ? ` Cidade líder: ${topCity.label}, com ${pf(topCity.percent)} da base.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShareChart title="Principais cidades" subtitle="Top 10 por participação de seguidores" rows={cities} />
        <ShareChart title="Principais países" subtitle="Top 10 por participação de seguidores" rows={countries} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgeGenderChart rows={ageGender} />
        <AgeGenderTable rows={ageGender} />
      </div>
    </div>
  )
}
