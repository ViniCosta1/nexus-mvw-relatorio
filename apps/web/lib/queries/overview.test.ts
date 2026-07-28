import { describe, expect, it } from "vitest"
import { getDefaultDateRange, previousPeriod } from "./overview"

describe("getDefaultDateRange", () => {
  it("returns a range spanning exactly `days` days ending today (UTC midnight)", () => {
    const range = getDefaultDateRange(30)

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    expect(range.to.getTime()).toBe(today.getTime())

    const expectedFrom = new Date(today)
    expectedFrom.setUTCDate(expectedFrom.getUTCDate() - 29)
    expect(range.from.getTime()).toBe(expectedFrom.getTime())

    const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000))
    expect(spanDays).toBe(29)
  })

  it("respects a custom `days` argument", () => {
    const range = getDefaultDateRange(7)
    const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000))
    expect(spanDays).toBe(6)
  })
})

describe("previousPeriod", () => {
  it("returns a same-length window immediately preceding the given range, with no overlap and no gap", () => {
    const range = {
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 0, 30)),
    }

    const prev = previousPeriod(range)

    expect(prev.from.toISOString().slice(0, 10)).toBe("2025-12-02")
    expect(prev.to.toISOString().slice(0, 10)).toBe("2025-12-31")

    // no gap: prev.to is exactly one day before range.from
    const oneDayMs = 24 * 60 * 60 * 1000
    expect(range.from.getTime() - prev.to.getTime()).toBe(oneDayMs)

    // same length as the original range
    expect(prev.to.getTime() - prev.from.getTime()).toBe(range.to.getTime() - range.from.getTime())

    // no overlap
    expect(prev.to.getTime()).toBeLessThan(range.from.getTime())
  })

  it("handles a single-day range with no overlap or gap", () => {
    const range = {
      from: new Date(Date.UTC(2026, 5, 15)),
      to: new Date(Date.UTC(2026, 5, 15)),
    }

    const prev = previousPeriod(range)

    expect(prev.from.toISOString().slice(0, 10)).toBe("2026-06-14")
    expect(prev.to.toISOString().slice(0, 10)).toBe("2026-06-14")
  })
})
