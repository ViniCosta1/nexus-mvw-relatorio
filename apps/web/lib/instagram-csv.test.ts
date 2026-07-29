import { describe, expect, it } from "vitest"
import {
  mergeDailyPoints,
  monthlyTotals,
  parseAudienceCsv,
  parseMetricCsv,
  type DailyPoint,
} from "./instagram-csv"

const METRIC_CSV = [
  "sep=,",
  '"Alcance"',
  '"Data","Primary"',
  '"2026-06-01T00:00:00","596"',
  '"2026-06-02T00:00:00","844"',
  '"2026-07-01T00:00:00","1258"',
  "",
].join("\n")

describe("parseMetricCsv", () => {
  it("reads the title from the second line", () => {
    expect(parseMetricCsv(METRIC_CSV).title).toBe("Alcance")
  })

  it("turns each row into a YYYY-MM-DD point", () => {
    expect(parseMetricCsv(METRIC_CSV).points).toEqual([
      { date: "2026-06-01", value: 596 },
      { date: "2026-06-02", value: 844 },
      { date: "2026-07-01", value: 1258 },
    ])
  })

  it("skips the sep= directive, the header and blank lines", () => {
    expect(parseMetricCsv(METRIC_CSV).points).toHaveLength(3)
  })

  it("returns an empty series for an empty export", () => {
    expect(parseMetricCsv('sep=,\n"Alcance"\n"Data","Primary"\n')).toEqual({
      title: "Alcance",
      points: [],
    })
  })

  it("treats a non-numeric value as zero rather than dropping the day", () => {
    const csv = 'sep=,\n"Alcance"\n"Data","Primary"\n"2026-06-01T00:00:00",""\n'
    expect(parseMetricCsv(csv).points).toEqual([{ date: "2026-06-01", value: 0 }])
  })
})

describe("mergeDailyPoints", () => {
  // The June export runs to the end of July, so June and July folders overlap.
  // The month-specific export is the later, more complete one and wins.
  it("prefers the folder whose month matches the date", () => {
    const merged = mergeDailyPoints([
      { folderMonth: "2026-06", points: [{ date: "2026-07-29", value: 3 }] },
      { folderMonth: "2026-07", points: [{ date: "2026-07-29", value: 25 }] },
    ])
    expect(merged).toEqual([{ date: "2026-07-29", value: 25 }])
  })

  it("keeps the match even when the non-matching folder comes last", () => {
    const merged = mergeDailyPoints([
      { folderMonth: "2026-07", points: [{ date: "2026-07-29", value: 25 }] },
      { folderMonth: "2026-06", points: [{ date: "2026-07-29", value: 3 }] },
    ])
    expect(merged).toEqual([{ date: "2026-07-29", value: 25 }])
  })

  it("keeps days that only one export has", () => {
    const merged = mergeDailyPoints([
      { folderMonth: "2026-05", points: [{ date: "2026-05-31", value: 10 }] },
      { folderMonth: "2026-06", points: [{ date: "2026-06-01", value: 20 }] },
    ])
    expect(merged.map((p) => p.date)).toEqual(["2026-05-31", "2026-06-01"])
  })

  it("returns the days in chronological order", () => {
    const merged = mergeDailyPoints([
      { folderMonth: "2026-07", points: [{ date: "2026-07-02", value: 2 }] },
      { folderMonth: "2026-06", points: [{ date: "2026-06-30", value: 1 }] },
    ])
    expect(merged.map((p) => p.date)).toEqual(["2026-06-30", "2026-07-02"])
  })
})

describe("monthlyTotals", () => {
  const points: DailyPoint[] = [
    { date: "2026-05-31", value: 10 },
    { date: "2026-06-01", value: 20 },
    { date: "2026-06-02", value: 5 },
    { date: "2026-07-01", value: 7 },
  ]

  it("sums each month and keeps them in order", () => {
    expect(monthlyTotals(points)).toEqual([
      { month: "2026-05", total: 10, days: 1 },
      { month: "2026-06", total: 25, days: 2 },
      { month: "2026-07", total: 7, days: 1 },
    ])
  })

  it("returns nothing for an empty series", () => {
    expect(monthlyTotals([])).toEqual([])
  })
})

const AUDIENCE_CSV = [
  "sep=,",
  '"Principais cidades"',
  '"São Paulo, SP","Jaú, SP"',
  '"5.4","3.9"',
  "",
  '"Principais países"',
  '"Brasil","Portugal"',
  '"93.8","1.3"',
  "",
  '"Faixa etária e gênero"',
  '"","Homens","Mulheres"',
  '"18-24","3.5","1.2"',
  '"25-34","15.3","6.2"',
  "",
].join("\n")

describe("parseAudienceCsv", () => {
  it("pairs each city with its share", () => {
    expect(parseAudienceCsv(AUDIENCE_CSV).cities).toEqual([
      { label: "São Paulo, SP", percent: 5.4 },
      { label: "Jaú, SP", percent: 3.9 },
    ])
  })

  it("pairs each country with its share", () => {
    expect(parseAudienceCsv(AUDIENCE_CSV).countries).toEqual([
      { label: "Brasil", percent: 93.8 },
      { label: "Portugal", percent: 1.3 },
    ])
  })

  it("reads the age brackets with both genders", () => {
    expect(parseAudienceCsv(AUDIENCE_CSV).ageGender).toEqual([
      { range: "18-24", homens: 3.5, mulheres: 1.2 },
      { range: "25-34", homens: 15.3, mulheres: 6.2 },
    ])
  })

  it("returns empty sections when the export has none", () => {
    expect(parseAudienceCsv("sep=,\n")).toEqual({ cities: [], countries: [], ageGender: [] })
  })
})
