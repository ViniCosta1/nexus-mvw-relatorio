import { Suspense } from "react"
import { Warning } from "@phosphor-icons/react/dist/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { VendasSkeleton } from "@/components/dashboard/skeletons"
import {
  formatMetricRange,
  formatMetricValue,
  getSocialSellingMetrics,
  getSocialSellingNotes,
  type SocialSellingNoteRow,
} from "@/lib/queries/social-selling"

export default async function SocialSellingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Social Selling</h1>
        <p className="text-muted-foreground text-sm">Prospecção ativa no perfil — cadência e qualidade de lead</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Cadências de trabalho registradas manualmente, não medidas por API. São faixas porque a rotina é executada
          em faixa, e não em um número exato por dia.
        </p>
      </div>

      <Suspense fallback={<VendasSkeleton />}>
        <SocialSellingContent />
      </Suspense>
    </div>
  )
}

const TONE_STYLES: Record<SocialSellingNoteRow["tone"], string> = {
  ALERTA: "border-destructive/40 bg-destructive/5",
  NEUTRO: "",
  POSITIVO: "border-primary/40 bg-primary/5",
}

async function SocialSellingContent() {
  const [metrics, notes] = await Promise.all([getSocialSellingMetrics(), getSocialSellingNotes()])

  if (metrics.length === 0 && notes.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nada cadastrado ainda para social selling.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMetricValue(metric)}</div>
              <p className="text-muted-foreground mt-1 text-xs">{formatMetricRange(metric)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {notes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações da operação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {notes.map((note) => (
              <div key={note.key} className={`flex gap-3 rounded-md border p-3 ${TONE_STYLES[note.tone]}`}>
                {note.tone === "ALERTA" ? (
                  <Warning size={18} weight="fill" className="text-destructive mt-0.5 shrink-0" />
                ) : null}
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{note.title}</p>
                  <p className="text-muted-foreground text-sm">{note.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
