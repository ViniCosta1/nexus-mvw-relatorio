import { describe, expect, it } from "vitest"
import { formatMetricRange, formatMetricValue, type SocialSellingMetricRow } from "./social-selling"

function metric(overrides: Partial<SocialSellingMetricRow> = {}): SocialSellingMetricRow {
  return {
    id: "m1",
    key: "novas-abordagens",
    label: "Novas abordagens",
    minValue: 30,
    maxValue: 60,
    unit: "abordagens",
    cadence: "por dia",
    ...overrides,
  }
}

describe("formatMetricValue", () => {
  it("shows a range as min a max", () => {
    expect(formatMetricValue(metric())).toBe("30 a 60")
  })

  it("collapses to a single number when the range has no spread", () => {
    expect(formatMetricValue(metric({ minValue: 30, maxValue: 30 }))).toBe("30")
  })

  it("groups thousands in pt-BR", () => {
    expect(formatMetricValue(metric({ minValue: 1200, maxValue: 3400 }))).toBe("1.200 a 3.400")
  })
})

describe("formatMetricRange", () => {
  it("spells out unit and cadence", () => {
    expect(formatMetricRange(metric())).toBe("abordagens por dia")
  })

  it("drops the cadence when there is none", () => {
    expect(formatMetricRange(metric({ unit: "leads", cadence: "" }))).toBe("leads")
  })

  it("keeps a cadence that is not a frequency", () => {
    expect(formatMetricRange(metric({ unit: "leads", cadence: "na base" }))).toBe("leads na base")
  })
})
