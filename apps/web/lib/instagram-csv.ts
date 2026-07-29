/**
 * Parsing for the Instagram CSV exports kept in `lib/data`. These replaced the
 * Graph API pull: the exports are downloaded by hand from the app, one folder
 * per month, so everything here is pure string work with no clock and no I/O —
 * the file reading lives in `lib/queries/instagram-files.ts`.
 *
 * Export shape (UTF-16, decoded before it gets here):
 *
 *   sep=,
 *   "Alcance"
 *   "Data","Primary"
 *   "2026-06-01T00:00:00","596"
 */

export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
}

export interface MetricSeries {
  title: string
  points: DailyPoint[]
}

export interface MonthTotal {
  /** YYYY-MM */
  month: string
  total: number
  /** How many days the export actually carries for that month. */
  days: number
}

export interface AudienceShare {
  label: string
  percent: number
}

export interface AgeGenderRow {
  range: string
  homens: number
  mulheres: number
}

export interface AudienceBreakdown {
  cities: AudienceShare[]
  countries: AudienceShare[]
  ageGender: AgeGenderRow[]
}

/** Splits a CSV line on commas outside quotes and strips the quotes. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

function toNumber(raw: string | undefined): number {
  if (!raw) return 0
  const n = Number(raw.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function parseMetricCsv(text: string): MetricSeries {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "")
  const body = lines.filter((l) => !l.startsWith("sep="))
  const title = body[0] ? splitCsvLine(body[0])[0] ?? "" : ""

  const points: DailyPoint[] = []
  for (const line of body.slice(1)) {
    const [rawDate, rawValue] = splitCsvLine(line)
    // The header row repeats inside some exports; the date column identifies it.
    if (!rawDate || rawDate === "Data") continue
    const date = rawDate.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    points.push({ date, value: Math.round(toNumber(rawValue)) })
  }

  return { title, points }
}

/**
 * Folds the per-folder exports into one series per metric. The June export runs
 * past the end of June (it covers the following month too), so June and July
 * overlap on the same days. The export whose folder matches the date is the
 * later, more complete download and wins — without that rule the last day of
 * July would keep whichever partial snapshot happened to load last.
 */
export function mergeDailyPoints(
  sources: { folderMonth: string; points: DailyPoint[] }[],
): DailyPoint[] {
  const byDate = new Map<string, { value: number; fromMatchingFolder: boolean }>()

  for (const source of sources) {
    for (const point of source.points) {
      const matches = point.date.slice(0, 7) === source.folderMonth
      const existing = byDate.get(point.date)
      if (existing && existing.fromMatchingFolder && !matches) continue
      byDate.set(point.date, { value: point.value, fromMatchingFolder: matches })
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { value }]) => ({ date, value }))
}

export function monthlyTotals(points: DailyPoint[]): MonthTotal[] {
  const byMonth = new Map<string, { total: number; days: number }>()

  for (const point of points) {
    const month = point.date.slice(0, 7)
    const bucket = byMonth.get(month)
    if (bucket) {
      bucket.total += point.value
      bucket.days += 1
    } else {
      byMonth.set(month, { total: point.value, days: 1 })
    }
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, days }]) => ({ month, total, days }))
}

/**
 * The audience export is three stacked blocks, each a title line followed by a
 * labels line and a values line (the age block carries two value columns).
 */
export function parseAudienceCsv(text: string): AudienceBreakdown {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("sep="))

  const result: AudienceBreakdown = { cities: [], countries: [], ageGender: [] }

  for (let i = 0; i < lines.length; i++) {
    const heading = splitCsvLine(lines[i]!)[0]

    if (heading === "Principais cidades" || heading === "Principais países") {
      const labels = splitCsvLine(lines[i + 1] ?? "")
      const values = splitCsvLine(lines[i + 2] ?? "")
      const shares = labels
        .map((label, index) => ({ label, percent: toNumber(values[index]) }))
        .filter((s) => s.label !== "")
      if (heading === "Principais cidades") result.cities = shares
      else result.countries = shares
      i += 2
      continue
    }

    if (heading === "Faixa etária e gênero") {
      // The next line is the gender header; rows run until the block ends.
      for (let j = i + 2; j < lines.length; j++) {
        const [range, homens, mulheres] = splitCsvLine(lines[j]!)
        if (!range || !/^\d/.test(range)) break
        result.ageGender.push({
          range,
          homens: toNumber(homens),
          mulheres: toNumber(mulheres),
        })
      }
    }
  }

  return result
}
