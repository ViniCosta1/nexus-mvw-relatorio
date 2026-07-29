import { describe, expect, it } from "vitest"
import { buildSocialSeries, sumSocialTotals, type SocialDailyRow } from "./social"

function totals(overrides: Partial<Parameters<typeof sumSocialTotals>[0][number]> = {}) {
  return {
    reach: 0,
    views: 0,
    totalInteractions: 0,
    accountsEngaged: 0,
    follows: 0,
    unfollows: 0,
    followsNet: 0,
    ...overrides,
  }
}

function daily(date: string, overrides: Partial<SocialDailyRow> = {}): SocialDailyRow {
  return {
    date,
    reach: 0,
    views: 0,
    totalInteractions: 0,
    accountsEngaged: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    followsNet: 0,
    ...overrides,
  }
}

describe("sumSocialTotals", () => {
  it("sums every metric across rows", () => {
    const result = sumSocialTotals([
      totals({ reach: 10, views: 100, totalInteractions: 5, accountsEngaged: 4, follows: 3, unfollows: 1, followsNet: 2 }),
      totals({ reach: 20, views: 200, totalInteractions: 7, accountsEngaged: 6, follows: 5, unfollows: 2, followsNet: 3 }),
    ])
    expect(result).toEqual({
      reach: 30,
      views: 300,
      totalInteractions: 12,
      accountsEngaged: 10,
      follows: 8,
      unfollows: 3,
      followsNet: 5,
    })
  })

  it("returns zeros for an empty period", () => {
    expect(sumSocialTotals([])).toEqual(totals())
  })

  it("keeps a negative net when the period lost followers", () => {
    const result = sumSocialTotals([totals({ followsNet: 4 }), totals({ followsNet: -9 })])
    expect(result.followsNet).toBe(-5)
  })
})

describe("buildSocialSeries", () => {
  const range = { from: new Date(Date.UTC(2026, 6, 27)), to: new Date(Date.UTC(2026, 6, 29)) }

  it("emits one point per day in the range", () => {
    const series = buildSocialSeries([daily("2026-07-28", { reach: 5 })], range)
    expect(series.map((p) => p.date)).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"])
  })

  it("uses null for days with no collected data, so the chart shows a gap and not a zero", () => {
    const series = buildSocialSeries([daily("2026-07-28", { reach: 5, views: 9, followsNet: 2 })], range)
    expect(series[0]).toEqual({ date: "2026-07-27", reach: null, views: null, followsNet: null })
    expect(series[1]).toEqual({ date: "2026-07-28", reach: 5, views: 9, followsNet: 2 })
    expect(series[2]!.reach).toBeNull()
  })

  it("keeps a real zero distinct from a missing day", () => {
    const series = buildSocialSeries([daily("2026-07-27", { reach: 0 })], range)
    expect(series[0]!.reach).toBe(0)
    expect(series[1]!.reach).toBeNull()
  })

  it("returns an empty series for an empty range with no rows", () => {
    const single = { from: new Date(Date.UTC(2026, 6, 29)), to: new Date(Date.UTC(2026, 6, 29)) }
    expect(buildSocialSeries([], single)).toEqual([
      { date: "2026-07-29", reach: null, views: null, followsNet: null },
    ])
  })
})
