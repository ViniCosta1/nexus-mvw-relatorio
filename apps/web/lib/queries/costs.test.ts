import { describe, expect, it } from "vitest"
import {
  costAppliesToMonth,
  monthsInRange,
  recurringMonthlyTotal,
  totalForMonth,
  type CostRow,
} from "./costs"

function cost(overrides: Partial<CostRow> = {}): CostRow {
  return {
    id: "c1",
    name: "Make Pro",
    category: "Ferramenta",
    amount: 60,
    kind: "MONTHLY",
    startMonth: "2026-06",
    endMonth: null,
    hasVariable: false,
    note: null,
    ...overrides,
  }
}

describe("costAppliesToMonth", () => {
  it("includes an open-ended monthly cost from its start month onwards", () => {
    expect(costAppliesToMonth(cost(), "2026-06")).toBe(true)
    expect(costAppliesToMonth(cost(), "2026-12")).toBe(true)
  })

  it("excludes months before the cost started", () => {
    expect(costAppliesToMonth(cost(), "2026-05")).toBe(false)
  })

  it("excludes months after it ended", () => {
    const meppy = cost({ name: "Meppy", kind: "ONE_OFF", endMonth: "2026-06" })
    expect(costAppliesToMonth(meppy, "2026-06")).toBe(true)
    expect(costAppliesToMonth(meppy, "2026-07")).toBe(false)
  })
})

describe("recurringMonthlyTotal", () => {
  it("adds up only the monthly costs still running in the reference month", () => {
    const rows = [
      cost({ id: "a", amount: 7000, name: "Lavinia" }),
      cost({ id: "b", amount: 4000, name: "Grupo Nexus" }),
      cost({ id: "c", amount: 1000, name: "Meppy", kind: "ONE_OFF", endMonth: "2026-06" }),
    ]
    expect(recurringMonthlyTotal(rows, "2026-07")).toBe(11000)
  })

  it("counts a one-off nowhere, even in the month it was charged", () => {
    const rows = [cost({ amount: 65, kind: "ONE_OFF", endMonth: "2026-06" })]
    expect(recurringMonthlyTotal(rows, "2026-06")).toBe(0)
  })

  it("returns zero when nothing is running", () => {
    expect(recurringMonthlyTotal([], "2026-07")).toBe(0)
  })
})

describe("totalForMonth", () => {
  it("sums every cost charged in that month, recurring and one-off alike", () => {
    const rows = [
      cost({ id: "a", amount: 60 }),
      cost({ id: "b", amount: 1000, kind: "ONE_OFF", endMonth: "2026-06" }),
      cost({ id: "c", amount: 65, kind: "ONE_OFF", endMonth: "2026-06" }),
    ]
    expect(totalForMonth(rows, "2026-06")).toBe(1125)
    expect(totalForMonth(rows, "2026-07")).toBe(60)
  })

  it("ignores the variable part, which has no number attached", () => {
    const rows = [cost({ amount: 1500, name: "Karol SS", hasVariable: true })]
    expect(totalForMonth(rows, "2026-07")).toBe(1500)
  })
})

describe("monthsInRange", () => {
  it("lists every month from the earliest start to the reference month", () => {
    expect(monthsInRange([cost({ startMonth: "2026-06" })], "2026-09")).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ])
  })

  it("crosses the year boundary", () => {
    expect(monthsInRange([cost({ startMonth: "2026-11" })], "2027-01")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ])
  })

  it("returns the reference month alone when there are no costs", () => {
    expect(monthsInRange([], "2026-07")).toEqual(["2026-07"])
  })

  it("never runs backwards when a cost starts after the reference month", () => {
    expect(monthsInRange([cost({ startMonth: "2026-09" })], "2026-07")).toEqual(["2026-07"])
  })
})
