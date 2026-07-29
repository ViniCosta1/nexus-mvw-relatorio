"use client"

import { Trophy } from "@phosphor-icons/react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export function HighlightCard({
  title,
  name,
  metric,
  reason,
}: {
  title: string
  name: string
  metric: string
  reason?: string
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Trophy size={18} weight="fill" className="text-primary" />
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="truncate text-lg font-semibold" title={name}>
          {name}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{metric}</p>
        {reason ? <p className="mt-2 text-sm leading-snug">{reason}</p> : null}
      </CardContent>
    </Card>
  )
}
