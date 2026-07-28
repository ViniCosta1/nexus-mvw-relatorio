"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { SpendVsSalesPoint } from "@/lib/queries/overview"
import { formatCurrencyBRL, formatDateBR } from "@/lib/format"

export function SpendVsSalesChart({ data }: { data: SpendVsSalesPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Investimento × Vendas</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDateBR(d)}
              className="text-xs"
            />
            <YAxis tickFormatter={(v: number) => formatCurrencyBRL(v)} width={90} className="text-xs" />
            <Tooltip
              formatter={(value) => formatCurrencyBRL(typeof value === "number" ? value : 0) as React.ReactNode}
              labelFormatter={(d) => formatDateBR(String(d)) as React.ReactNode}
            />
            <Line type="monotone" dataKey="spend" name="Investido" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="revenue" name="Vendido" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
