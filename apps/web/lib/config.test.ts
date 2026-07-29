import { afterEach, describe, expect, it, vi } from "vitest"
import { SOCIAL_COLLECTION_START_DATE, SOCIAL_COLLECTION_START_DAY } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("SOCIAL_COLLECTION_START_DAY", () => {
  it("defaults to the day daily Instagram collection began", () => {
    expect(SOCIAL_COLLECTION_START_DAY).toBe("2026-07-29")
  })

  it("is UTC midnight, so date formatting never slips a day in Brazil", () => {
    expect(SOCIAL_COLLECTION_START_DATE.toISOString()).toBe("2026-07-29T00:00:00.000Z")
  })

  it("honours the SOCIAL_START_DATE override", async () => {
    vi.resetModules()
    vi.stubEnv("SOCIAL_START_DATE", "2026-08-15")
    const mod = await import("./config")
    expect(mod.SOCIAL_COLLECTION_START_DAY).toBe("2026-08-15")
  })
})
