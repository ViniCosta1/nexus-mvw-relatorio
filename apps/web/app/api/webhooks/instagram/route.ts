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
