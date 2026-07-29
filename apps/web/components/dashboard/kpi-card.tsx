import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InfoHint, type KpiInfo } from "@/components/dashboard/info-hint"

export function KpiCard({
  title,
  value,
  hint,
  info,
}: {
  title: string
  value: string
  hint?: string
  info?: KpiInfo
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        {info ? <InfoHint info={info} label={title} /> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
