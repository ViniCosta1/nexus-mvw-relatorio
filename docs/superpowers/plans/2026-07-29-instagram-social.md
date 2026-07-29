# Instagram — Coleta Diária e Página Social — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receive daily Instagram profile metrics from a Make.com scenario through a new webhook, store one dated row per day, and surface them on a `/social` page with KPIs, an evolution chart and a daily table.

**Architecture:** A Make scenario POSTs a flat JSON contract to `/api/webhooks/instagram`. The route authenticates with a shared secret, delegates all parsing/validation to a pure function in `lib/instagram.ts`, upserts one `InstagramDailyStat` row per `(ig_user_id, date)`, and logs a `SyncRun`. The `/social` page reads only from Postgres, following the existing page shape (`FilterBar` + `Suspense` + async content component).

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6 + Postgres, recharts 3, Tailwind v4 + shadcn (`@workspace/ui`), Phosphor icons, Vitest, Bun.

Spec: `docs/superpowers/specs/2026-07-29-instagram-social-design.md`.

## Global Constraints

- Package manager is **Bun**. All commands run from `apps/web` unless stated: `bun run test`, `bun run typecheck`, `bun run lint`, `bun run db:push`.
- There is no Prisma migrations folder — schema changes ship via `bun run db:push` (which also regenerates the client).
- All user-facing copy is **pt-BR**.
- Tests are **pure-function only** — the existing suite never touches the database. Anything needing Prisma is verified manually with the steps written into the task.
- Instagram data has **no date floor**. `ACCOUNT_START_DATE` / `clampFrom` (2026-06-01) apply to Meta Ads spend only and must never filter Instagram rows.
- Webhook auth is **fail-closed**: no `INSTAGRAM_WEBHOOK_SECRET` configured on the server → `401`.
- Per-row webhook errors never fail the batch: collect them, return `200` with `errors[]`.
- Daily collection start date shown to users: **2026-07-29**.
- Never combine Instagram metrics with Meta Ads or Greenn sales into a single derived metric — there is no attribution between them.

---

### Task 1: Schema, enum value and collection-start config

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Modify: `apps/web/lib/config.ts`
- Test: `apps/web/lib/config.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Prisma model `InstagramDailyStat` with fields `igUserId, username, date, reach, views, totalInteractions, accountsEngaged, likes, comments, saves, shares, replies, reposts, profileLinksTaps, follows, unfollows, followsNet, raw, syncedAt` and unique `(igUserId, date)`.
  - `SyncSource.INSTAGRAM` enum value.
  - `export const SOCIAL_COLLECTION_START_DATE: Date`
  - `export const SOCIAL_COLLECTION_START_DAY: string` (`YYYY-MM-DD`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/config.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test lib/config.test.ts`
Expected: FAIL — `SOCIAL_COLLECTION_START_DATE` is not exported from `./config`.

- [ ] **Step 3: Add the config constants**

Append to `apps/web/lib/config.ts`:

```ts
// Daily Instagram collection is driven by a Make scenario that started running
// on this date. Insights the Graph API still had in its ~30-day retention were
// backfilled in the first run, so older days exist but were not collected daily
// — the /social page states this instead of hiding those rows.
export const SOCIAL_COLLECTION_START_DATE = new Date(
  `${process.env.SOCIAL_START_DATE ?? "2026-07-29"}T00:00:00.000Z`,
)

/** YYYY-MM-DD form of SOCIAL_COLLECTION_START_DATE. */
export const SOCIAL_COLLECTION_START_DAY = SOCIAL_COLLECTION_START_DATE.toISOString().slice(0, 10)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test lib/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the enum value and the model**

In `apps/web/prisma/schema.prisma`, change the `SyncSource` enum to:

```prisma
enum SyncSource {
  META
  SHEETS
  INSTAGRAM
}
```

And append the model at the end of the file:

```prisma
// One row per Instagram profile per calendar day, pushed by a Make scenario.
// Independent of Campaign/Sale on purpose: nothing attributes organic Instagram
// activity to an ad campaign or a ticket sale, so there is no relation to draw.
model InstagramDailyStat {
  id                String   @id @default(cuid())
  igUserId          String   @map("ig_user_id")
  username          String?
  date              DateTime @db.Date
  reach             Int      @default(0)
  views             Int      @default(0)
  totalInteractions Int      @default(0) @map("total_interactions")
  accountsEngaged   Int      @default(0) @map("accounts_engaged")
  likes             Int      @default(0)
  comments          Int      @default(0)
  saves             Int      @default(0)
  shares            Int      @default(0)
  replies           Int      @default(0)
  reposts           Int      @default(0)
  profileLinksTaps  Int      @default(0) @map("profile_links_taps")
  follows           Int      @default(0)
  unfollows         Int      @default(0)
  followsNet        Int      @default(0) @map("follows_net")
  // Untouched payload as received. Lets us backfill a metric we don't have a
  // column for yet without re-running the Make scenario.
  raw               Json
  syncedAt          DateTime @default(now()) @map("synced_at")

  @@unique([igUserId, date])
  @@index([date])
  @@map("instagram_daily_stats")
}
```

- [ ] **Step 6: Push the schema and regenerate the client**

Run: `cd apps/web && bun run db:push`
Expected: `Your database is now in sync with your Prisma schema.` followed by `Generated Prisma Client`.

If `DATABASE_URL` is not set locally, run `bunx prisma generate` instead so the types exist, and note in the commit body that `db:push` still has to run against the deploy database.

- [ ] **Step 7: Verify types**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/lib/config.ts apps/web/lib/config.test.ts
git commit -m "feat: add InstagramDailyStat model and social collection start date"
```

---

### Task 2: Pure payload normalization

**Files:**
- Create: `apps/web/lib/instagram.ts`
- Test: `apps/web/lib/instagram.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface InstagramDailyInput {
  igUserId: string
  username: string | null
  date: Date // UTC midnight
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  likes: number
  comments: number
  saves: number
  shares: number
  replies: number
  reposts: number
  profileLinksTaps: number
  follows: number
  unfollows: number
  followsNet: number
  raw: unknown
}

export interface NormalizeResult {
  rows: InstagramDailyInput[]
  errors: string[]
}

export function normalizeInstagramPayload(body: unknown, today: Date): NormalizeResult
```

`today` is injected (never read from the clock inside) so the future-date rule is testable.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/instagram.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test lib/instagram.test.ts`
Expected: FAIL — cannot resolve `./instagram`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/instagram.ts`:

```ts
/**
 * Parsing for the Instagram daily-stats webhook payload, kept free of Prisma so
 * it can be unit-tested. `today` is injected rather than read from the clock so
 * the future-date rule is deterministic under test.
 */

export interface InstagramDailyInput {
  igUserId: string
  username: string | null
  date: Date
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  likes: number
  comments: number
  saves: number
  shares: number
  replies: number
  reposts: number
  profileLinksTaps: number
  follows: number
  unfollows: number
  followsNet: number
  raw: unknown
}

export interface NormalizeResult {
  rows: InstagramDailyInput[]
  errors: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toInt(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function toDateOnlyUTC(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

function unwrap(body: unknown): { items: unknown[]; error?: string } {
  if (Array.isArray(body)) return { items: body }
  if (body && typeof body === "object") {
    const data = (body as Record<string, unknown>).data
    if (Array.isArray(data)) return { items: data }
    return { items: [body] }
  }
  return { items: [], error: "corpo do payload não é um objeto nem uma lista" }
}

export function normalizeInstagramPayload(body: unknown, today: Date): NormalizeResult {
  const { items, error } = unwrap(body)
  const errors: string[] = error ? [error] : []

  // Keyed by profile+day so a batch that repeats a day writes once. Map keeps
  // insertion order and the later value wins, matching the upsert semantics.
  const byKey = new Map<string, InstagramDailyInput>()
  const todayDay = today.toISOString().slice(0, 10)

  items.forEach((item, index) => {
    const label = `linha ${index + 1}`
    if (!item || typeof item !== "object") {
      errors.push(`${label}: não é um objeto`)
      return
    }
    const row = item as Record<string, unknown>

    const igUserId = typeof row.ig_user_id === "string" ? row.ig_user_id.trim() : ""
    if (!igUserId) {
      errors.push(`${label}: ig_user_id ausente`)
      return
    }

    const day = typeof row.date === "string" ? row.date.trim() : ""
    if (!DATE_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00.000Z`))) {
      errors.push(`${label}: date ausente ou fora do formato YYYY-MM-DD`)
      return
    }
    if (day > todayDay) {
      errors.push(`${label}: date ${day} é futura, ignorando`)
      return
    }

    const follows = toInt(row.follows)
    const unfollows = toInt(row.unfollows)

    byKey.set(`${igUserId}__${day}`, {
      igUserId,
      username: typeof row.username === "string" && row.username.trim() ? row.username.trim() : null,
      date: toDateOnlyUTC(day),
      reach: toInt(row.reach),
      views: toInt(row.views),
      totalInteractions: toInt(row.total_interactions),
      accountsEngaged: toInt(row.accounts_engaged),
      likes: toInt(row.likes),
      comments: toInt(row.comments),
      saves: toInt(row.saves),
      shares: toInt(row.shares),
      replies: toInt(row.replies),
      reposts: toInt(row.reposts),
      profileLinksTaps: toInt(row.profile_links_taps),
      follows,
      unfollows,
      followsNet:
        row.follows_net === null || row.follows_net === undefined
          ? follows - unfollows
          : toInt(row.follows_net),
      raw: row,
    })
  })

  return { rows: [...byKey.values()], errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test lib/instagram.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/instagram.ts apps/web/lib/instagram.test.ts
git commit -m "feat: add Instagram webhook payload normalization"
```

---

### Task 3: Webhook route and Make integration doc

**Files:**
- Create: `apps/web/app/api/webhooks/instagram/route.ts`
- Create: `docs/integracoes/instagram-make.md`
- Modify: `apps/web/.env.example` (create it if it does not exist; check with `ls -a apps/web`)

**Interfaces:**
- Consumes: `normalizeInstagramPayload(body, today)` from Task 2; `SOCIAL_COLLECTION_START_DAY` is *not* used here (no date floor); `prisma` from `@/lib/db`; `SyncSource.INSTAGRAM` from Task 1.
- Produces: `POST /api/webhooks/instagram` returning `{ ok, processed, totalRows, errors }`.

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/webhooks/instagram/route.ts`:

```ts
import { NextResponse } from "next/server"
import { Prisma, SyncSource, SyncStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { normalizeInstagramPayload } from "@/lib/instagram"

function isAuthorized(request: Request): boolean {
  const expected = process.env.INSTAGRAM_WEBHOOK_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get("x-webhook-secret")
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  return headerSecret === expected || querySecret === expected
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 })
  }

  const { rows, errors } = normalizeInstagramPayload(body, new Date())

  let processed = 0
  // Rows are already deduped by (profile, day), so parallel upserts can't race
  // each other on the same unique key.
  await Promise.all(
    rows.map(async (row) => {
      const { igUserId, date, raw, username, ...metrics } = row
      try {
        const data = { ...metrics, raw: raw as Prisma.InputJsonValue }
        await prisma.instagramDailyStat.upsert({
          where: { igUserId_date: { igUserId, date } },
          // `username ?? undefined` on update: a payload that omits the handle
          // leaves the stored one alone instead of nulling it.
          update: { ...data, username: username ?? undefined },
          create: { igUserId, date, username, ...data },
        })
        processed++
      } catch (e) {
        errors.push(
          `${igUserId} em ${date.toISOString().slice(0, 10)}: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }),
  )

  await prisma.syncRun.create({
    data: {
      source: SyncSource.INSTAGRAM,
      finishedAt: new Date(),
      status: errors.length === 0 ? SyncStatus.SUCCESS : SyncStatus.ERROR,
      rowsProcessed: processed,
      errorMessage: errors.length > 0 ? errors.slice(0, 10).join(" | ") : undefined,
    },
  })

  return NextResponse.json({ ok: true, processed, totalRows: rows.length, errors })
}
```

- [ ] **Step 2: Verify types**

Run: `cd apps/web && bun run typecheck`
Expected: no errors. If `instagramDailyStat` or `igUserId_date` is unknown, the Prisma client was not regenerated — run `bunx prisma generate` and retry.

- [ ] **Step 3: Add the secret to the env example**

Add to `apps/web/.env.example`:

```
# Shared secret for the Make.com Instagram scenario (POST /api/webhooks/instagram).
# Without it the route answers 401 to everything.
INSTAGRAM_WEBHOOK_SECRET=

# Optional. Overrides the "daily collection started on" date shown on /social.
SOCIAL_START_DATE=
```

- [ ] **Step 4: Manual verification against a running dev server**

This route touches the database, so it is verified by hand — the test suite stays pure.

```bash
cd apps/web
INSTAGRAM_WEBHOOK_SECRET=teste bun run dev
```

In another terminal:

```bash
# 1. no secret -> 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/webhooks/instagram \
  -H 'content-type: application/json' -d '{}'

# 2. valid single day -> {"ok":true,"processed":1,...}
curl -s -X POST localhost:3000/api/webhooks/instagram \
  -H 'content-type: application/json' -H 'x-webhook-secret: teste' \
  -d '{"ig_user_id":"17841400000000000","username":"rafavendrami","date":"2026-07-29","reach":1234,"views":5678,"total_interactions":210,"accounts_engaged":180,"likes":150,"comments":20,"saves":25,"shares":15,"replies":5,"reposts":2,"profile_links_taps":12,"follows":30,"unfollows":4}'

# 3. same day again with a different reach -> still processed:1, no duplicate row
curl -s -X POST localhost:3000/api/webhooks/instagram \
  -H 'content-type: application/json' -H 'x-webhook-secret: teste' \
  -d '{"ig_user_id":"17841400000000000","date":"2026-07-29","reach":4321}'

# 4. batch with one bad row -> processed:1 and one entry in errors[]
curl -s -X POST localhost:3000/api/webhooks/instagram \
  -H 'content-type: application/json' -H 'x-webhook-secret: teste' \
  -d '{"data":[{"ig_user_id":"17841400000000000","date":"2026-07-28","reach":10},{"date":"2026-07-27"}]}'
```

Expected: `401`; then `processed:1`; then `processed:1` with `reach` overwritten to 4321 (check with `bun run db:studio`); then `processed:1` with `errors: ["linha 2: ig_user_id ausente"]`.

- [ ] **Step 5: Write the Make integration doc**

Create `docs/integracoes/instagram-make.md`:

```markdown
# Instagram → Relatório (cenário Make.com)

Cenário: **[RELATORIO] | CAPTURA DE DADOS INSTAGRAM**

## Módulos

1. **Instagram for Business (Facebook login) — Get user insights**
   - Page: `rafavendrami (@rafavendrami)`
   - Period: `Day`
   - Metrics: Reach, Views, Total interactions, Accounts engaged, Likes,
     Comments, Saves, Shares, Replies, Follows and unfollows, Profile links taps,
     Reposts.
2. **Transform to JSON** — monta o corpo no contrato abaixo.
3. **HTTP — Make a request**
   - Method: `POST`
   - URL: `https://<domínio>/api/webhooks/instagram`
   - Header: `x-webhook-secret: <INSTAGRAM_WEBHOOK_SECRET>`
   - Body type: `Raw`, content type `application/json`

## Contrato

Um objeto, um array de objetos, ou `{ "data": [ ... ] }`.

```json
{
  "ig_user_id": "17841400000000000",
  "username": "rafavendrami",
  "date": "2026-07-29",
  "reach": 1234,
  "views": 5678,
  "total_interactions": 210,
  "accounts_engaged": 180,
  "likes": 150,
  "comments": 20,
  "saves": 25,
  "shares": 15,
  "replies": 5,
  "reposts": 2,
  "profile_links_taps": 12,
  "follows": 30,
  "unfollows": 4
}
```

- `ig_user_id` e `date` (`YYYY-MM-DD`) são obrigatórios; sem eles a linha é
  recusada e aparece em `errors[]` na resposta.
- Qualquer métrica ausente vira `0`. Nunca derruba o lote.
- `follows_net` é opcional; sem ele o sistema calcula `follows - unfollows`.
- Data futura é recusada. Datas passadas são aceitas (backfill).
- Reenviar o mesmo dia sobrescreve o registro — pode rodar o cenário à vontade.

## Resposta

```json
{ "ok": true, "processed": 3, "totalRows": 4, "errors": ["linha 2: ig_user_id ausente"] }
```

`401` = segredo errado ou ausente. `400` = corpo não é JSON válido.

Cada execução grava um registro em `sync_runs` com `source = INSTAGRAM`.
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/webhooks/instagram/route.ts docs/integracoes/instagram-make.md apps/web/.env.example
git commit -m "feat: add Instagram daily stats webhook"
```

---

### Task 4: Queries and the un-clamped date range

**Files:**
- Modify: `apps/web/lib/queries/overview.ts` (the `resolveRange` function, around line 24)
- Modify: `apps/web/lib/queries/overview.test.ts`
- Create: `apps/web/lib/queries/social.ts`
- Test: `apps/web/lib/queries/social.test.ts` (create)

**Interfaces:**
- Consumes: `DateRange`, `previousPeriod`, `getDefaultDateRange`, `clampFrom`.
- Produces:

```ts
// overview.ts — new optional third argument, default behaviour unchanged
export function resolveRange(from?: string, to?: string, options?: { clamp?: boolean }): DateRange

// social.ts
export interface SocialTotals {
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  follows: number
  unfollows: number
  followsNet: number
}
export interface SocialDailyRow {
  date: string // YYYY-MM-DD
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  likes: number
  comments: number
  saves: number
  shares: number
  followsNet: number
}
export interface SocialSeriesPoint {
  date: string // YYYY-MM-DD, every day in the range
  reach: number | null
  views: number | null
  followsNet: number | null
}
export interface SocialSummary {
  current: SocialTotals
  previous: SocialTotals
}
export function sumSocialTotals(rows: SocialTotals[]): SocialTotals
export function buildSocialSeries(rows: SocialDailyRow[], range: DateRange): SocialSeriesPoint[]
export function getSocialSummary(range: DateRange): Promise<SocialSummary>
export function getSocialDaily(range: DateRange): Promise<SocialDailyRow[]>
```

- [ ] **Step 1: Write the failing test for the clamp option**

Append to `apps/web/lib/queries/overview.test.ts`:

```ts
import { resolveRange } from "./overview"

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
```

Add `resolveRange` to the existing import at the top of the file instead of a second import statement.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test lib/queries/overview.test.ts`
Expected: FAIL — the `{ clamp: false }` cases still return `2026-06-01`, and TypeScript rejects the third argument.

- [ ] **Step 3: Add the clamp option**

Replace `resolveRange` in `apps/web/lib/queries/overview.ts` with:

```ts
/**
 * Resolves the from/to query params into a DateRange, defaulting to the last 60
 * days. The lower bound is clamped to the account-management start date
 * (2026-06-01) so no Meta Ads view — default, preset, or hand-picked — reaches
 * into the prior agency's period.
 *
 * `clamp: false` opts out, for data streams the clamp doesn't govern: the
 * Instagram page reports organic activity, which was never under the prior
 * agency's spend, so its backfilled days must stay visible.
 */
export function resolveRange(
  from?: string,
  to?: string,
  options: { clamp?: boolean } = {},
): DateRange {
  const floor = (d: Date) => (options.clamp === false ? d : clampFrom(d))
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T00:00:00.000Z`)
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return { from: floor(fromDate), to: toDate }
    }
  }
  const def = getDefaultDateRange(60)
  return { from: floor(def.from), to: def.to }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test lib/queries/overview.test.ts`
Expected: PASS, including the pre-existing tests.

- [ ] **Step 5: Write the failing test for the social pure helpers**

Create `apps/web/lib/queries/social.test.ts`:

```ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/web && bun run test lib/queries/social.test.ts`
Expected: FAIL — cannot resolve `./social`.

- [ ] **Step 7: Write the queries module**

Create `apps/web/lib/queries/social.ts`:

```ts
import { prisma } from "@/lib/db"
import { previousPeriod, type DateRange } from "@/lib/queries/overview"

export interface SocialTotals {
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  follows: number
  unfollows: number
  followsNet: number
}

export interface SocialDailyRow {
  date: string
  reach: number
  views: number
  totalInteractions: number
  accountsEngaged: number
  likes: number
  comments: number
  saves: number
  shares: number
  followsNet: number
}

export interface SocialSeriesPoint {
  date: string
  reach: number | null
  views: number | null
  followsNet: number | null
}

export interface SocialSummary {
  current: SocialTotals
  previous: SocialTotals
}

const EMPTY_TOTALS: SocialTotals = {
  reach: 0,
  views: 0,
  totalInteractions: 0,
  accountsEngaged: 0,
  follows: 0,
  unfollows: 0,
  followsNet: 0,
}

export function sumSocialTotals(rows: SocialTotals[]): SocialTotals {
  return rows.reduce<SocialTotals>(
    (acc, r) => ({
      reach: acc.reach + r.reach,
      views: acc.views + r.views,
      totalInteractions: acc.totalInteractions + r.totalInteractions,
      accountsEngaged: acc.accountsEngaged + r.accountsEngaged,
      follows: acc.follows + r.follows,
      unfollows: acc.unfollows + r.unfollows,
      followsNet: acc.followsNet + r.followsNet,
    }),
    { ...EMPTY_TOTALS },
  )
}

/**
 * Expands the collected rows into one point per calendar day in the range,
 * leaving days we never received as `null`. A missing day means the Make
 * scenario didn't run — plotting it as 0 would read as "no reach that day",
 * which is a different and false claim.
 */
export function buildSocialSeries(rows: SocialDailyRow[], range: DateRange): SocialSeriesPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const points: SocialSeriesPoint[] = []
  const cursor = new Date(range.from.getTime())
  while (cursor.getTime() <= range.to.getTime()) {
    const day = cursor.toISOString().slice(0, 10)
    const row = byDate.get(day)
    points.push({
      date: day,
      reach: row ? row.reach : null,
      views: row ? row.views : null,
      followsNet: row ? row.followsNet : null,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return points
}

const TOTALS_SELECT = {
  reach: true,
  views: true,
  totalInteractions: true,
  accountsEngaged: true,
  follows: true,
  unfollows: true,
  followsNet: true,
} as const

export async function getSocialSummary(range: DateRange): Promise<SocialSummary> {
  const prev = previousPeriod(range)
  const [current, previous] = await Promise.all([
    prisma.instagramDailyStat.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: TOTALS_SELECT,
    }),
    prisma.instagramDailyStat.findMany({
      where: { date: { gte: prev.from, lte: prev.to } },
      select: TOTALS_SELECT,
    }),
  ])

  return { current: sumSocialTotals(current), previous: sumSocialTotals(previous) }
}

export async function getSocialDaily(range: DateRange): Promise<SocialDailyRow[]> {
  const rows = await prisma.instagramDailyStat.findMany({
    where: { date: { gte: range.from, lte: range.to } },
    orderBy: { date: "desc" },
  })

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    reach: r.reach,
    views: r.views,
    totalInteractions: r.totalInteractions,
    accountsEngaged: r.accountsEngaged,
    likes: r.likes,
    comments: r.comments,
    saves: r.saves,
    shares: r.shares,
    followsNet: r.followsNet,
  }))
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `cd apps/web && bun run test && bun run typecheck`
Expected: all tests PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/queries/social.ts apps/web/lib/queries/social.test.ts apps/web/lib/queries/overview.ts apps/web/lib/queries/overview.test.ts
git commit -m "feat: add social queries and opt-out for the account-start clamp"
```

---

### Task 5: Presentational components

**Files:**
- Create: `apps/web/components/dashboard/social-collection-note.tsx`
- Create: `apps/web/components/dashboard/social-chart.tsx`
- Create: `apps/web/components/dashboard/social-daily-table.tsx`
- Modify: `apps/web/components/dashboard/skeletons.tsx`

**Interfaces:**
- Consumes: `SocialSeriesPoint`, `SocialDailyRow` from Task 4; `SOCIAL_COLLECTION_START_DATE` from Task 1; `formatDateBR`, `formatDateFullBR`, `formatDateLongBR` from `@/lib/format`.
- Produces: `<SocialCollectionNote />`, `<SocialChart data={SocialSeriesPoint[]} />`, `<SocialDailyTable rows={SocialDailyRow[]} />`, `<SocialSkeleton />`.

- [ ] **Step 1: Write the collection note**

Create `apps/web/components/dashboard/social-collection-note.tsx`:

```tsx
import { SOCIAL_COLLECTION_START_DATE } from "@/lib/config"
import { formatDateFullBR } from "@/lib/format"

/**
 * Standing note on the /social page. The Instagram Graph API only retains ~30
 * days of account insights, so the first run backfilled what it still had —
 * days before the collection start exist but were not collected daily, and the
 * note says so instead of quietly presenting them as the same thing.
 */
export function SocialCollectionNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Coleta diária do Instagram iniciada em{" "}
      <span className="text-foreground font-semibold">{formatDateFullBR(SOCIAL_COLLECTION_START_DATE)}</span>. Dias
      anteriores vieram de uma carga única do histórico da API (limite de ~30 dias).
    </p>
  )
}
```

- [ ] **Step 2: Write the chart**

Create `apps/web/components/dashboard/social-chart.tsx`:

```tsx
"use client"

import React from "react"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import type { SocialSeriesPoint } from "@/lib/queries/social"
import { formatDateBR } from "@/lib/format"

const nf = (n: number) => n.toLocaleString("pt-BR")

/**
 * Reach and views as lines on the left axis, follower balance as bars on the
 * right axis (different unit, different scale). `connectNulls` stays false so a
 * day the Make scenario never delivered shows as a gap, not as a zero.
 */
export function SocialChart({ data }: { data: SocialSeriesPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução diária</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDateBR(d)} className="text-xs" />
            <YAxis yAxisId="left" tickFormatter={(v: number) => nf(v)} width={70} className="text-xs" />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => nf(v)} width={50} className="text-xs" />
            <Tooltip
              formatter={(value) => (typeof value === "number" ? nf(value) : "—") as React.ReactNode}
              labelFormatter={(d) => formatDateBR(String(d)) as React.ReactNode}
            />
            <Legend />
            <Bar
              yAxisId="right"
              dataKey="followsNet"
              name="Seguidores (saldo)"
              fill="var(--color-chart-3)"
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="reach"
              name="Alcance"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="views"
              name="Visualizações"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Write the daily table**

Create `apps/web/components/dashboard/social-daily-table.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import type { SocialDailyRow } from "@/lib/queries/social"
import { formatDateLongBR } from "@/lib/format"

const nf = (n: number) => n.toLocaleString("pt-BR")
/** Follower balance is signed: "+12" and "-3" read very differently from "12" and "3". */
const signed = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`

export function SocialDailyTable({ rows }: { rows: SocialDailyRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dia a dia ({rows.length} dias)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
              <TableHead className="text-right">Visualizações</TableHead>
              <TableHead className="text-right">Interações</TableHead>
              <TableHead className="text-right">Contas engajadas</TableHead>
              <TableHead className="text-right">Curtidas</TableHead>
              <TableHead className="text-right">Comentários</TableHead>
              <TableHead className="text-right">Salvos</TableHead>
              <TableHead className="text-right">Compart.</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="whitespace-nowrap">{formatDateLongBR(`${row.date}T00:00:00.000Z`)}</TableCell>
                <TableCell className="text-right">{nf(row.reach)}</TableCell>
                <TableCell className="text-right">{nf(row.views)}</TableCell>
                <TableCell className="text-right">{nf(row.totalInteractions)}</TableCell>
                <TableCell className="text-right">{nf(row.accountsEngaged)}</TableCell>
                <TableCell className="text-right">{nf(row.likes)}</TableCell>
                <TableCell className="text-right">{nf(row.comments)}</TableCell>
                <TableCell className="text-right">{nf(row.saves)}</TableCell>
                <TableCell className="text-right">{nf(row.shares)}</TableCell>
                <TableCell className="text-right">{signed(row.followsNet)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Add the skeleton**

Append to `apps/web/components/dashboard/skeletons.tsx`:

```tsx
/** Loading placeholder for the Social page (KPIs, chart, daily table). */
export function SocialSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-28" />
        ))}
      </div>
      <Block className="h-80" />
      <Block className="h-96" />
    </div>
  )
}
```

- [ ] **Step 5: Verify types and lint**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/dashboard/social-collection-note.tsx apps/web/components/dashboard/social-chart.tsx apps/web/components/dashboard/social-daily-table.tsx apps/web/components/dashboard/skeletons.tsx
git commit -m "feat: add social note, chart and daily table components"
```

---

### Task 6: `/social` page and navigation

**Files:**
- Create: `apps/web/app/(dashboard)/social/page.tsx`
- Modify: `apps/web/components/dashboard-nav.tsx:7` (icon import) and `:12-16` (`NAV_ITEMS`)
- Modify: `apps/web/components/filters/filter-bar.tsx:23-41` and `:129-140`

**Interfaces:**
- Consumes: `resolveRange(from, to, { clamp: false })`, `getSocialSummary`, `getSocialDaily`, `buildSocialSeries` (Task 4); `SocialCollectionNote`, `SocialChart`, `SocialDailyTable`, `SocialSkeleton` (Task 5); `KpiCard` and `KpiInfo` (existing).
- Produces: route `/social`, nav entry "Social", and a `FilterBar` whose `accountStartDay` and `showSearch` props are optional.

- [ ] **Step 1: Add the nav entry**

In `apps/web/components/dashboard-nav.tsx`, extend the icon import and the items list:

```tsx
import { ChartBar, InstagramLogo, List, Megaphone, Users } from "@phosphor-icons/react"
```

```tsx
const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: ChartBar },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/vendas", label: "Vendas & Clientes", icon: Users },
  { href: "/social", label: "Social", icon: InstagramLogo },
]
```

- [ ] **Step 2: Make the FilterBar's account floor and search box optional**

`FilterBar` today requires `accountStartDay` (it floors the "30 dias"/"60 dias"
preset buttons at 2026-06-01, mirroring the server clamp) and always renders a
search field labelled "Buscar vendedor, campanha, criativo...". Neither fits
`/social`: there is no date floor, and there is nothing to search. Make both
optional, leaving the three existing pages untouched.

In `apps/web/components/filters/filter-bar.tsx`, change `presetRange` and the
props:

```tsx
/**
 * The from/to a preset would produce: `days` back from today, but never earlier
 * than the account start (traffic began 2026-06-01). Kept identical to the
 * server-side clamp so a preset button lights up when it matches the URL range.
 * Pages with no floor (Instagram, which the clamp doesn't govern) omit it.
 */
function presetRange(days: number, todayISO: string, accountStartDay?: string) {
  const to = new Date(`${todayISO}T00:00:00.000Z`)
  const fromDate = new Date(to)
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
  const fromISO = toISODate(fromDate)
  return {
    from: accountStartDay && fromISO < accountStartDay ? accountStartDay : fromISO,
    to: todayISO,
  }
}

export function FilterBar({
  from,
  to,
  todayISO,
  accountStartDay,
  showSearch = true,
}: {
  from: string
  to: string
  todayISO: string
  accountStartDay?: string
  showSearch?: boolean
}) {
```

And wrap the search block (the `<div className="relative w-full sm:w-72">` …
`</div>` at the end of the row) in the flag:

```tsx
        {showSearch ? (
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              size={16}
            />
            <Input
              placeholder="Buscar vendedor, campanha, criativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        ) : null}
```

Run: `cd apps/web && bun run typecheck`
Expected: no errors — the other three pages keep passing `accountStartDay` and get the search box by default.

- [ ] **Step 3: Write the page**

Create `apps/web/app/(dashboard)/social/page.tsx`:

```tsx
import { Suspense } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { SocialChart } from "@/components/dashboard/social-chart"
import { SocialCollectionNote } from "@/components/dashboard/social-collection-note"
import { SocialDailyTable } from "@/components/dashboard/social-daily-table"
import { SocialSkeleton } from "@/components/dashboard/skeletons"
import type { KpiInfo } from "@/components/dashboard/info-hint"
import { FilterBar } from "@/components/filters/filter-bar"
import { formatDateFullBR, formatDateLongBR } from "@/lib/format"
import { SOCIAL_COLLECTION_START_DATE } from "@/lib/config"
import { buildSocialSeries, getSocialDaily, getSocialSummary } from "@/lib/queries/social"
import { resolveRange, type DateRange } from "@/lib/queries/overview"

const KPI_INFO: Record<string, KpiInfo> = {
  followers: {
    what: "Saldo de seguidores no período: quem começou a seguir menos quem deixou de seguir.",
    example: "Ex.: 120 novos seguidores e 18 saídas no mês = +102.",
    why: "Mostra se o perfil está crescendo de verdade, não só atraindo e perdendo gente.",
  },
  reach: {
    what: "Contas únicas alcançadas pelo perfil no período (não conta a mesma pessoa duas vezes).",
    example: "Ex.: 8.400 contas viram algum conteúdo do perfil em junho.",
    why: "Mede o tamanho real da audiência atingida pelo conteúdo orgânico.",
  },
  views: {
    what: "Total de visualizações do conteúdo do perfil, contando repetições.",
    example: "Ex.: 23.000 visualizações somando feed, reels e stories.",
    why: "Mede volume de exibição; comparado ao alcance, indica quanto cada pessoa vê em média.",
  },
  interactions: {
    what: "Soma de curtidas, comentários, salvamentos e compartilhamentos no período.",
    example: "Ex.: 1.250 interações no mês.",
    why: "É o sinal de que o conteúdo mobilizou quem viu, não só apareceu.",
  },
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  // No clamp: the 2026-06-01 floor governs Meta Ads spend under a prior agency,
  // not organic Instagram activity.
  const range = resolveRange(params.from, params.to, { clamp: false })
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
  const fromISO = range.from.toISOString().slice(0, 10)
  const toISO = range.to.toISOString().slice(0, 10)
  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="text-muted-foreground text-sm">
          Instagram orgânico · {formatDateLongBR(range.from)} – {formatDateLongBR(range.to)} ({spanDays} dias)
        </p>
        <div className="mt-1">
          <SocialCollectionNote />
        </div>
      </div>

      {/* No accountStartDay: the 2026-06-01 floor is a Meta Ads rule. No search:
          nothing on this page is searchable. */}
      <FilterBar from={fromISO} to={toISO} todayISO={todayISO} showSearch={false} />

      <Suspense key={`${fromISO}|${toISO}`} fallback={<SocialSkeleton />}>
        <SocialContent range={range} />
      </Suspense>
    </div>
  )
}

async function SocialContent({ range }: { range: DateRange }) {
  const [summary, daily] = await Promise.all([getSocialSummary(range), getSocialDaily(range)])

  if (daily.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhum dado de Instagram neste período. A coleta diária começou em{" "}
          {formatDateFullBR(SOCIAL_COLLECTION_START_DATE)} — se o período selecionado já passou dessa data, verifique se
          o cenário do Make rodou.
        </CardContent>
      </Card>
    )
  }

  const { current, previous } = summary
  const nf = (n: number) => n.toLocaleString("pt-BR")
  const signed = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`

  /** "12% vs. período anterior" — omitted when the previous window had nothing to compare against. */
  const delta = (now: number, before: number) =>
    before === 0 ? undefined : `${now >= before ? "+" : ""}${(((now - before) / before) * 100).toFixed(0)}% vs. período anterior`

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Seguidores ganhos"
          value={signed(current.followsNet)}
          hint={`${nf(current.follows)} novos · ${nf(current.unfollows)} saíram`}
          info={KPI_INFO.followers}
        />
        <KpiCard
          title="Alcance"
          value={nf(current.reach)}
          hint={delta(current.reach, previous.reach)}
          info={KPI_INFO.reach}
        />
        <KpiCard
          title="Visualizações"
          value={nf(current.views)}
          hint={delta(current.views, previous.views)}
          info={KPI_INFO.views}
        />
        <KpiCard
          title="Interações"
          value={nf(current.totalInteractions)}
          hint={delta(current.totalInteractions, previous.totalInteractions)}
          info={KPI_INFO.interactions}
        />
      </div>

      <SocialChart data={buildSocialSeries(daily, range)} />
      <SocialDailyTable rows={daily} />
    </>
  )
}
```

- [ ] **Step 4: Verify types, lint and tests**

Run: `cd apps/web && bun run typecheck && bun run lint && bun run test`
Expected: no errors, all tests pass.

- [ ] **Step 5: Manual verification in the browser**

```bash
cd apps/web && INSTAGRAM_WEBHOOK_SECRET=teste bun run dev
```

- Open `http://localhost:3000/social`. With an empty table, the empty state renders and no chart or table appears.
- POST the four curl payloads from Task 3 Step 4, reload: 4 KPI cards, chart, and daily table appear.
- Confirm the day between two collected days plots as a gap in the reach line, not a drop to zero.
- Confirm the "Social" item is in the sidebar and highlighted while on `/social`.
- Narrow the window to mobile width: the sidebar collapses into the hamburger Sheet, "Social" is listed there, and the daily table scrolls horizontally instead of pushing the page wide.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/social/page.tsx apps/web/components/dashboard-nav.tsx apps/web/components/filters/filter-bar.tsx
git commit -m "feat: add /social page with Instagram KPIs, chart and daily table"
```

---

## Verificação final

- [ ] `cd apps/web && bun run test` — todos os testes passam
- [ ] `cd apps/web && bun run typecheck` — sem erros
- [ ] `cd apps/web && bun run lint` — sem erros
- [ ] `cd /home/vini-dev/Projetos/nexus-mvw-relatorio && bun run build` — build do monorepo passa
- [ ] `INSTAGRAM_WEBHOOK_SECRET` configurado no ambiente de deploy
- [ ] `bun run db:push` executado contra o banco de deploy
- [ ] URL do módulo HTTP no Make trocada de `mvw-report.free.beeceptor.com` para `https://<domínio>/api/webhooks/instagram`, com o header `x-webhook-secret`
