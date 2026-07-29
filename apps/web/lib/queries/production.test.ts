import { describe, expect, it } from "vitest"
import { groupDeliveriesByMonth, sumDeliveries, type DeliveryRow } from "./production"

function row(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: "d1",
    key: "artes-2026-06",
    label: "Artes",
    kind: "ARTE",
    month: "2026-06",
    quantity: 47,
    ...overrides,
  }
}

describe("sumDeliveries", () => {
  it("totals pieces by kind", () => {
    const rows = [
      row({ quantity: 47 }),
      row({ id: "d2", key: "videos-2026-06", label: "Vídeos", kind: "VIDEO", quantity: 5 }),
      row({ id: "d3", key: "artes-2026-07", month: "2026-07", quantity: 129 }),
    ]
    expect(sumDeliveries(rows)).toEqual({ artes: 176, videos: 5, total: 181 })
  })

  it("ignores milestones, which have no count", () => {
    const rows = [
      row({ id: "m1", key: "site-oficial", label: "Site oficial", kind: "MARCO", month: null, quantity: null }),
      row({ quantity: 47 }),
    ]
    expect(sumDeliveries(rows)).toEqual({ artes: 47, videos: 0, total: 47 })
  })

  it("returns zeros for nothing delivered", () => {
    expect(sumDeliveries([])).toEqual({ artes: 0, videos: 0, total: 0 })
  })
})

describe("groupDeliveriesByMonth", () => {
  it("groups counted deliveries by month, newest month first", () => {
    const rows = [
      row({ id: "a", quantity: 47 }),
      row({ id: "b", key: "artes-2026-07", month: "2026-07", quantity: 129 }),
      row({
        id: "c",
        key: "artes-oficiais-evento-2026-07",
        label: "Artes oficiais do evento",
        month: "2026-07",
        quantity: 22,
      }),
    ]
    const groups = groupDeliveriesByMonth(rows)
    expect(groups.map((g) => g.month)).toEqual(["2026-07", "2026-06"])
    expect(groups[0]!.total).toBe(151)
    expect(groups[0]!.items.map((i) => i.label)).toEqual(["Artes", "Artes oficiais do evento"])
    expect(groups[1]!.total).toBe(47)
  })

  it("leaves milestones out of the monthly groups", () => {
    const rows = [
      row({ id: "m1", key: "logos", label: "Reestilização das logos", kind: "MARCO", month: null, quantity: null }),
    ]
    expect(groupDeliveriesByMonth(rows)).toEqual([])
  })
})
