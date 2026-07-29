import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { cache } from "react"
import {
  mergeDailyPoints,
  monthlyTotals,
  parseAudienceCsv,
  parseMetricCsv,
  type AudienceBreakdown,
  type DailyPoint,
  type MonthTotal,
} from "@/lib/instagram-csv"

/**
 * Reads the Instagram exports under `lib/data`. These replaced the Graph API
 * pull — the webhook still exists but nothing feeds it, so the /social page
 * reports what was exported by hand from the app.
 *
 * Folders are named after the month in Portuguese ("Maio", "Junho", "Julho")
 * and hold one CSV per metric. Adding a new month means dropping a folder in;
 * nothing here is hardcoded to the months that exist today.
 */

const DATA_DIR = path.join(process.cwd(), "lib", "data")
const AUDIENCE_FILE = "Público.csv"

/** Exports are UTF-16 LE with a BOM, which is what Instagram hands you. */
const ENCODING = "utf16le"

export const METRICS = [
  { key: "alcance", file: "Alcance.csv", label: "Alcance", hint: "Contas únicas alcançadas" },
  { key: "visualizacoes", file: "Visualizações.csv", label: "Visualizações", hint: "Exibições de conteúdo" },
  { key: "interacoes", file: "Interações.csv", label: "Interações", hint: "Curtidas, comentários, salvos e compartilhamentos" },
  { key: "visitas", file: "Visitas.csv", label: "Visitas ao perfil", hint: "Aberturas do perfil" },
  { key: "cliques", file: "Cliques no link.csv", label: "Cliques no link", hint: "Cliques no link da bio" },
  { key: "seguidores", file: "Seguidores.csv", label: "Seguidores ganhos", hint: "Saldo de seguidores no período" },
] as const

export type MetricKey = (typeof METRICS)[number]["key"]

/** Folder name → first day of that month, so the merge can spot its own month. */
const MONTH_BY_FOLDER: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
}

export interface InstagramDataset {
  /** Every metric, deduped across folders and sorted by day. */
  daily: Record<MetricKey, DailyPoint[]>
  /** Month totals per metric, oldest first. */
  totals: Record<MetricKey, MonthTotal[]>
  /** Every month present in the exports, oldest first (`YYYY-MM`). */
  months: string[]
  audience: AudienceBreakdown
}

async function readCsv(...segments: string[]): Promise<string | null> {
  try {
    return await readFile(path.join(DATA_DIR, ...segments), ENCODING)
  } catch {
    // A month folder that doesn't carry every metric is normal, not an error.
    return null
  }
}

/**
 * Folder month as `YYYY-MM`. The exports have no year in the folder name, so it
 * is taken from the rows themselves — the folder only says which month owns the
 * file when two exports overlap.
 */
function folderMonthFrom(folder: string, points: DailyPoint[]): string {
  const monthNumber = MONTH_BY_FOLDER[folder.toLowerCase()]
  if (!monthNumber) return ""
  const sameMonth = points.find((p) => p.date.slice(5, 7) === monthNumber)
  return sameMonth ? sameMonth.date.slice(0, 7) : ""
}

async function listMonthFolders(): Promise<string[]> {
  const entries = await readdir(DATA_DIR, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

/**
 * `cache` dedupes the reads within a single request — the page pulls the same
 * dataset from more than one component.
 */
export const getInstagramDataset = cache(async (): Promise<InstagramDataset> => {
  const folders = await listMonthFolders()

  const daily = {} as Record<MetricKey, DailyPoint[]>
  const totals = {} as Record<MetricKey, MonthTotal[]>

  for (const metric of METRICS) {
    const sources: { folderMonth: string; points: DailyPoint[] }[] = []

    for (const folder of folders) {
      const text = await readCsv(folder, metric.file)
      if (text === null) continue
      const { points } = parseMetricCsv(text)
      if (points.length === 0) continue
      sources.push({ folderMonth: folderMonthFrom(folder, points), points })
    }

    const merged = mergeDailyPoints(sources)
    daily[metric.key] = merged
    totals[metric.key] = monthlyTotals(merged)
  }

  const months = [
    ...new Set(Object.values(totals).flatMap((list) => list.map((t) => t.month))),
  ].sort()

  const audienceText = await readCsv(AUDIENCE_FILE)

  return {
    daily,
    totals,
    months,
    audience: audienceText ? parseAudienceCsv(audienceText) : { cities: [], countries: [], ageGender: [] },
  }
})
