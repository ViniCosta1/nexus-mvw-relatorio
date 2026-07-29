"use client"

import React from "react"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import type { SocialSeriesPoint } from "@/lib/queries/social"
import { formatDateBR } from "@/lib/format"

const nf = (n: number) => n.toLocaleString("pt-BR")

/**
 * Reach and views as lines on the left axis, follower balance as bars on the
 * right axis (different unit, different scale). `connectNulls` stays false so a
 * day the Make scenario never delivered shows as a gap, not as a zero.
 */
export function SocialChart({ data }: { data: SocialSeriesPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução diária</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDateBR(d)} className="text-xs" />
            <YAxis yAxisId="left" tickFormatter={(v: number) => nf(v)} width={70} className="text-xs" />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => nf(v)} width={50} className="text-xs" />
            <Tooltip
              formatter={(value) => (typeof value === "number" ? nf(value) : "—") as React.ReactNode}
              labelFormatter={(d) => formatDateBR(String(d)) as React.ReactNode}
            />
            <Legend />
            <Bar
              yAxisId="right"
              dataKey="followsNet"
              name="Seguidores (saldo)"
              fill="var(--color-chart-3)"
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="reach"
              name="Alcance"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="views"
              name="Visualizações"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
