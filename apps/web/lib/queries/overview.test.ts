import { describe, expect, it } from "vitest"
import {
  deliveryStatus,
  getDefaultDateRange,
  periodRoi,
  previousPeriod,
  resolveRange,
} from "./overview"

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

describe("resolveRange", () => {
  it("clamps the lower bound to the account start date by default", () => {
    const range = resolveRange("2026-01-01", "2026-07-01")
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-06-01")
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-07-01")
  })

  it("leaves the lower bound alone when clamping is disabled", () => {
    const range = resolveRange("2026-01-01", "2026-07-01", { clamp: false })
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-01-01")
  })

  it("does not clamp the default range when clamping is disabled", () => {
    const range = resolveRange(undefined, undefined, { clamp: false })
    const expected = new Date()
    expected.setUTCHours(0, 0, 0, 0)
    expected.setUTCDate(expected.getUTCDate() - 59)
    expect(range.from.getTime()).toBe(expected.getTime())
  })
})

describe("deliveryStatus", () => {
  const TODAY = "2026-07-29"

  it("marks a campaign delivering when it served on a fresh last collected day", () => {
    expect(deliveryStatus("2026-07-29", "2026-07-29", TODAY)).toEqual({
      state: "DELIVERING",
      lastDay: "2026-07-29",
    })
  })

  it("still counts yesterday as delivering, since today's day is usually incomplete", () => {
    expect(deliveryStatus("2026-07-28", "2026-07-28", TODAY).state).toBe("DELIVERING")
  })

  it("marks a campaign stopped when its last impression predates the last collected day", () => {
    expect(deliveryStatus("2026-07-10", "2026-07-28", TODAY)).toEqual({
      state: "STOPPED",
      lastDay: "2026-07-10",
    })
  })

  it("never claims delivery from stale data: an account 6 days cold reads as stopped", () => {
    // The whole point of the bug this replaced: every campaign showed "Ativa"
    // from a default column. A campaign that last served on the newest day we
    // have is only "delivering" if that day is recent — otherwise all we know is
    // that it ran until then and the pipeline went quiet.
    expect(deliveryStatus("2026-07-23", "2026-07-23", TODAY)).toEqual({
      state: "STOPPED",
      lastDay: "2026-07-23",
    })
  })

  it("reports no data when the campaign never had an impression in the period", () => {
    expect(deliveryStatus(null, "2026-07-23", TODAY)).toEqual({ state: "NO_DATA", lastDay: null })
  })

  it("reports no data when nothing at all was collected in the period", () => {
    expect(deliveryStatus(null, null, TODAY)).toEqual({ state: "NO_DATA", lastDay: null })
  })
})

describe("periodRoi", () => {
  it("returns the percentage return over the amount invested", () => {
    expect(periodRoi(8369, 2700)).toBeCloseTo(209.96, 2)
  })

  it("is zero when revenue exactly matches spend", () => {
    expect(periodRoi(2700, 2700)).toBe(0)
  })

  it("goes negative when the period sold less than it spent", () => {
    expect(periodRoi(1350, 2700)).toBe(-50)
  })

  it("is -100% when nothing sold", () => {
    expect(periodRoi(0, 2700)).toBe(-100)
  })

  it("returns null with no spend, since a return over zero is undefined", () => {
    expect(periodRoi(8369, 0)).toBeNull()
  })
})
