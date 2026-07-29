"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatDateBR, formatMonthBR } from "@/lib/format"
import type { DailyPoint, MonthTotal } from "@/lib/instagram-csv"

export interface ExplorerMetric {
  key: string
  label: string
  hint: string
}

const nf = (n: number) => n.toLocaleString("pt-BR")

/** Recharts hands label formatters a loose value type; normalise it here. */
const labelNumber = (value: unknown) => nf(Number(value) || 0)

/**
 * Months are an ordered entity, so they get a light→dark ramp of the brand hue
 * rather than unrelated categorical hues: oldest reads faintest, newest darkest.
 * Every bar is also directly labelled, which is what carries the value when the
 * lightest step falls under 3:1 against the surface.
 */
const MONTH_SHADES = [
  "oklch(0.80 0.10 144)",
  "oklch(0.68 0.219 144)",
  "oklch(0.48 0.17 144)",
  "oklch(0.34 0.12 144)",
]

function shadeFor(month: string, months: string[]): string {
  const index = months.indexOf(month)
  // Newest month always takes the darkest step, so adding a month re-steps the
  // ramp instead of running out of shades.
  const offset = Math.max(0, MONTH_SHADES.length - months.length)
  return MONTH_SHADES[Math.min(MONTH_SHADES.length - 1, offset + index)]!
}

/** "+12%" / "-8%", or null when the previous month has no base to compare to. */
function percentChange(current: number, previous: number): string | null {
  if (previous === 0) return null
  const delta = ((current - previous) / previous) * 100
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`
}

export function InstagramExplorer({
  metrics,
  months,
  totals,
  daily,
  contentStartDay,
}: {
  metrics: ExplorerMetric[]
  months: string[]
  totals: Record<string, MonthTotal[]>
  daily: Record<string, DailyPoint[]>
  /** YYYY-MM-DD the content work began — marked on the daily chart. */
  contentStartDay: string
}) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [dailyMetric, setDailyMetric] = useState<string>(metrics[0]?.key ?? "")

  const activeMetric = metrics.find((m) => m.key === dailyMetric) ?? metrics[0]

  const dailyRows = useMemo(() => {
    const points = daily[dailyMetric] ?? []
    return selectedMonth === null ? points : points.filter((p) => p.date.slice(0, 7) === selectedMonth)
  }, [daily, dailyMetric, selectedMonth])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Mês:</span>
        <Button
          type="button"
          size="sm"
          variant={selectedMonth === null ? "default" : "outline"}
          onClick={() => setSelectedMonth(null)}
        >
          Comparar meses
        </Button>
        {months.map((month) => (
          <Button
            key={month}
            type="button"
            size="sm"
            className="capitalize"
            variant={selectedMonth === month ? "default" : "outline"}
            onClick={() => setSelectedMonth(month)}
          >
            {formatMonthBR(month)}
          </Button>
        ))}
      </div>

      {selectedMonth === null ? (
        <ComparisonGrid metrics={metrics} months={months} totals={totals} />
      ) : (
        <MonthKpis metrics={metrics} month={selectedMonth} months={months} totals={totals} />
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              {activeMetric?.label} dia a dia
              {selectedMonth ? <span className="capitalize"> — {formatMonthBR(selectedMonth)}</span> : null}
            </CardTitle>
            <span className="text-muted-foreground text-xs">{activeMetric?.hint}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <Button
                key={metric.key}
                type="button"
                size="sm"
                variant={metric.key === dailyMetric ? "secondary" : "ghost"}
                onClick={() => setDailyMetric(metric.key)}
              >
                {metric.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyRows} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatDateBR(`${d}T00:00:00.000Z`)} className="text-xs" minTickGap={24} />
              <YAxis tickFormatter={(v: number) => nf(v)} width={70} className="text-xs" />
              <Tooltip
                formatter={(value) => [nf(typeof value === "number" ? value : 0), activeMetric?.label ?? ""]}
                labelFormatter={(d) => formatDateBR(`${String(d)}T00:00:00.000Z`)}
              />
              {dailyRows.some((r) => r.date >= contentStartDay) && dailyRows.some((r) => r.date <= contentStartDay) ? (
                <ReferenceLine
                  x={contentStartDay}
                  stroke="var(--color-chart-4)"
                  strokeDasharray="4 4"
                  label={{ value: "Grupo Nexus - início dos conteúdos", position: "insideTopLeft", fontSize: 11 }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                name={activeMetric?.label ?? ""}
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {selectedMonth === null ? <TotalsTable metrics={metrics} months={months} totals={totals} /> : null}
    </div>
  )
}

/** One small chart per metric: same three months side by side, own axis each. */
function ComparisonGrid({
  metrics,
  months,
  totals,
}: {
  metrics: ExplorerMetric[]
  months: string[]
  totals: Record<string, MonthTotal[]>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {metrics.map((metric) => {
        const data = months.map((month) => ({
          month,
          label: formatMonthBR(month).replace(/ de \d{4}$/, ""),
          total: totals[metric.key]?.find((t) => t.month === month)?.total ?? 0,
        }))
        return (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <span className="text-muted-foreground text-xs">{metric.hint}</span>
            </CardHeader>
            <CardContent className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, left: 0, right: 0, bottom: 0 }}>
                  <XAxis dataKey="label" className="text-xs capitalize" tickLine={false} axisLine={false} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, formatter: labelNumber }}>
                    {data.map((entry) => (
                      <Cell key={entry.month} fill={shadeFor(entry.month, months)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/** Totals of the selected month, each against the month before it. */
function MonthKpis({
  metrics,
  month,
  months,
  totals,
}: {
  metrics: ExplorerMetric[]
  month: string
  months: string[]
  totals: Record<string, MonthTotal[]>
}) {
  const previousMonth = months[months.indexOf(month) - 1] ?? null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric) => {
        const current = totals[metric.key]?.find((t) => t.month === month)
        const previous = previousMonth
          ? totals[metric.key]?.find((t) => t.month === previousMonth)
          : undefined
        const change =
          previous && previous.total > 0 && current ? percentChange(current.total, previous.total) : null

        return (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{nf(current?.total ?? 0)}</div>
              <p className="text-muted-foreground mt-1 text-xs">
                {change && previousMonth ? (
                  <>
                    {change} vs. <span className="capitalize">{formatMonthBR(previousMonth)}</span>
                  </>
                ) : (
                  metric.hint
                )}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/** The same numbers as the comparison charts, readable without color. */
function TotalsTable({
  metrics,
  months,
  totals,
}: {
  metrics: ExplorerMetric[]
  months: string[]
  totals: Record<string, MonthTotal[]>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Totais por mês</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Métrica</TableHead>
              {months.map((month) => (
                <TableHead key={month} className="text-right capitalize">
                  {formatMonthBR(month)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.key}>
                <TableCell className="font-medium">{metric.label}</TableCell>
                {months.map((month) => (
                  <TableCell key={month} className="text-right">
                    {nf(totals[metric.key]?.find((t) => t.month === month)?.total ?? 0)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell className="font-medium">Dias no export</TableCell>
              {months.map((month) => (
                <TableCell key={month} className="text-right font-medium">
                  {totals[metrics[0]?.key ?? ""]?.find((t) => t.month === month)?.days ?? 0}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
