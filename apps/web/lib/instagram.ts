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
