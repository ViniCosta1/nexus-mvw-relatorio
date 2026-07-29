import { Suspense } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { InstagramAudience } from "@/components/dashboard/instagram-audience"
import { InstagramExplorer } from "@/components/dashboard/instagram-explorer"
import { SocialSkeleton } from "@/components/dashboard/skeletons"
import { SOCIAL_CONTENT_START_DATE, SOCIAL_CONTENT_START_DAY } from "@/lib/config"
import { formatDateFullBR, formatMonthBR } from "@/lib/format"
import { getInstagramDataset, METRICS } from "@/lib/queries/instagram-files"

export default async function SocialPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="text-muted-foreground text-sm">Instagram orgânico — alcance, conteúdo e público</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Conteúdos do Instagram do Grupo Nexus iniciados em{" "}
          <span className="text-foreground font-semibold">{formatDateFullBR(SOCIAL_CONTENT_START_DATE)}</span>. Os dias
          anteriores aparecem como base de comparação — é o perfil antes da produção começar.
        </p>
      </div>

      <Suspense fallback={<SocialSkeleton />}>
        <SocialContent />
      </Suspense>
    </div>
  )
}

async function SocialContent() {
  const dataset = await getInstagramDataset()

  if (dataset.months.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhum export do Instagram encontrado em <code>lib/data</code>. Cada mês é uma pasta com os CSVs exportados
          do app.
        </CardContent>
      </Card>
    )
  }

  const first = dataset.months[0]!
  const last = dataset.months[dataset.months.length - 1]!

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">
        Fonte: exportação manual do app do Instagram (CSV), <span className="capitalize">{formatMonthBR(first)}</span> a{" "}
        <span className="capitalize">{formatMonthBR(last)}</span>. A coleta diária por API está parada — enquanto
        estiver, estes arquivos são a fonte.
      </p>

      <InstagramExplorer
        metrics={METRICS.map((m) => ({ key: m.key, label: m.label, hint: m.hint }))}
        months={dataset.months}
        totals={dataset.totals}
        daily={dataset.daily}
        contentStartDay={SOCIAL_CONTENT_START_DAY}
      />

      <InstagramAudience
        cities={dataset.audience.cities}
        countries={dataset.audience.countries}
        ageGender={dataset.audience.ageGender}
      />
    </div>
  )
}
