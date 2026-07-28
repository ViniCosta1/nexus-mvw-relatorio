import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { Insight } from "@/lib/insights"

const TONE_STYLES: Record<Insight["tone"], string> = {
  positive: "border-l-4 border-l-primary",
  warning: "border-l-4 border-l-destructive",
  neutral: "border-l-4 border-l-border",
}

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights do período</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {insights.map((insight) => (
          <p key={insight.id} className={cn("py-1 pl-3 text-sm", TONE_STYLES[insight.tone])}>
            {insight.message}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
