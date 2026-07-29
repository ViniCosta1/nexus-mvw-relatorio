import { describe, expect, it } from "vitest"
import { normalizeInstagramPayload } from "./instagram"

const TODAY = new Date(Date.UTC(2026, 6, 29)) // 2026-07-29

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    ig_user_id: "17841400000000000",
    username: "rafavendrami",
    date: "2026-07-29",
    reach: 1234,
    views: 5678,
    total_interactions: 210,
    accounts_engaged: 180,
    likes: 150,
    comments: 20,
    saves: 25,
    shares: 15,
    replies: 5,
    reposts: 2,
    profile_links_taps: 12,
    follows: 30,
    unfollows: 4,
    ...overrides,
  }
}

describe("normalizeInstagramPayload — shapes", () => {
  it("accepts a single object", () => {
    const { rows, errors } = normalizeInstagramPayload(baseRow(), TODAY)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.igUserId).toBe("17841400000000000")
    expect(rows[0]!.username).toBe("rafavendrami")
    expect(rows[0]!.reach).toBe(1234)
  })

  it("accepts a bare array", () => {
    const payload = [baseRow({ date: "2026-07-27" }), baseRow({ date: "2026-07-28" })]
    const { rows, errors } = normalizeInstagramPayload(payload, TODAY)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
  })

  it("accepts a { data: [...] } wrapper", () => {
    const payload = { data: [baseRow({ date: "2026-07-27" }), baseRow({ date: "2026-07-28" })] }
    const { rows } = normalizeInstagramPayload(payload, TODAY)
    expect(rows).toHaveLength(2)
  })

  it("returns an error for a payload that is not an object", () => {
    const { rows, errors } = normalizeInstagramPayload("nope", TODAY)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })
})

describe("normalizeInstagramPayload — dates", () => {
  it("parses the date as UTC midnight", () => {
    const { rows } = normalizeInstagramPayload(baseRow({ date: "2026-07-15" }), TODAY)
    expect(rows[0]!.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("accepts backfilled days before the collection start date", () => {
    const { rows, errors } = normalizeInstagramPayload(baseRow({ date: "2026-07-01" }), TODAY)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
  })

  it("rejects a missing date", () => {
    const row = baseRow()
    delete (row as Record<string, unknown>).date
    const { rows, errors } = normalizeInstagramPayload(row, TODAY)
    expect(rows).toEqual([])
    expect(errors[0]).toContain("date")
  })

  it("rejects a malformed date", () => {
    const { rows, errors } = normalizeInstagramPayload(baseRow({ date: "29/07/2026" }), TODAY)
    expect(rows).toEqual([])
    expect(errors[0]).toContain("date")
  })

  it("rejects a future date", () => {
    const { rows, errors } = normalizeInstagramPayload(baseRow({ date: "2026-07-30" }), TODAY)
    expect(rows).toEqual([])
    expect(errors[0]).toContain("futura")
  })

  it("accepts today itself", () => {
    const { rows, errors } = normalizeInstagramPayload(baseRow({ date: "2026-07-29" }), TODAY)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
  })
})

describe("normalizeInstagramPayload — identity", () => {
  it("rejects a row without ig_user_id", () => {
    const row = baseRow()
    delete (row as Record<string, unknown>).ig_user_id
    const { rows, errors } = normalizeInstagramPayload(row, TODAY)
    expect(rows).toEqual([])
    expect(errors[0]).toContain("ig_user_id")
  })

  it("keeps username null when absent", () => {
    const row = baseRow()
    delete (row as Record<string, unknown>).username
    const { rows } = normalizeInstagramPayload(row, TODAY)
    expect(rows[0]!.username).toBeNull()
  })

  it("reports the row position in the error message", () => {
    const payload = [baseRow(), baseRow({ ig_user_id: "" })]
    const { rows, errors } = normalizeInstagramPayload(payload, TODAY)
    expect(rows).toHaveLength(1)
    expect(errors[0]).toContain("linha 2")
  })
})

describe("normalizeInstagramPayload — metrics", () => {
  it("defaults missing metrics to zero", () => {
    const { rows } = normalizeInstagramPayload(
      { ig_user_id: "1", date: "2026-07-29" },
      TODAY,
    )
    const row = rows[0]!
    expect(row.reach).toBe(0)
    expect(row.views).toBe(0)
    expect(row.totalInteractions).toBe(0)
    expect(row.accountsEngaged).toBe(0)
    expect(row.likes).toBe(0)
    expect(row.comments).toBe(0)
    expect(row.saves).toBe(0)
    expect(row.shares).toBe(0)
    expect(row.replies).toBe(0)
    expect(row.reposts).toBe(0)
    expect(row.profileLinksTaps).toBe(0)
    expect(row.follows).toBe(0)
    expect(row.unfollows).toBe(0)
    expect(row.followsNet).toBe(0)
  })

  it("coerces numeric strings and null", () => {
    const { rows } = normalizeInstagramPayload(
      baseRow({ reach: "1234", views: null, likes: "abc" }),
      TODAY,
    )
    expect(rows[0]!.reach).toBe(1234)
    expect(rows[0]!.views).toBe(0)
    expect(rows[0]!.likes).toBe(0)
  })

  it("rounds fractional values", () => {
    const { rows } = normalizeInstagramPayload(baseRow({ reach: 10.6 }), TODAY)
    expect(rows[0]!.reach).toBe(11)
  })

  it("derives followsNet from follows minus unfollows", () => {
    const { rows } = normalizeInstagramPayload(baseRow({ follows: 30, unfollows: 4 }), TODAY)
    expect(rows[0]!.followsNet).toBe(26)
  })

  it("keeps a negative net when unfollows win", () => {
    const { rows } = normalizeInstagramPayload(baseRow({ follows: 2, unfollows: 9 }), TODAY)
    expect(rows[0]!.followsNet).toBe(-7)
  })

  it("uses follows_net when the payload sends it", () => {
    const { rows } = normalizeInstagramPayload(
      baseRow({ follows: 30, unfollows: 4, follows_net: 12 }),
      TODAY,
    )
    expect(rows[0]!.followsNet).toBe(12)
    expect(rows[0]!.follows).toBe(30)
    expect(rows[0]!.unfollows).toBe(4)
  })

  it("keeps the original payload in raw", () => {
    const row = baseRow()
    const { rows } = normalizeInstagramPayload(row, TODAY)
    expect(rows[0]!.raw).toEqual(row)
  })
})

describe("normalizeInstagramPayload — dedupe", () => {
  it("keeps only the last row for a repeated (ig_user_id, date)", () => {
    const payload = [baseRow({ reach: 1 }), baseRow({ reach: 999 })]
    const { rows } = normalizeInstagramPayload(payload, TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.reach).toBe(999)
  })

  it("does not dedupe different days of the same profile", () => {
    const payload = [baseRow({ date: "2026-07-28" }), baseRow({ date: "2026-07-29" })]
    const { rows } = normalizeInstagramPayload(payload, TODAY)
    expect(rows).toHaveLength(2)
  })

  it("does not dedupe the same day across different profiles", () => {
    const payload = [baseRow({ ig_user_id: "1" }), baseRow({ ig_user_id: "2" })]
    const { rows } = normalizeInstagramPayload(payload, TODAY)
    expect(rows).toHaveLength(2)
  })
})
