import { NextResponse } from "next/server"
import { SyncSource, SyncStatus } from "@prisma/client"
import { prisma } from "@/lib/db"

interface MetaAdInsightRow {
  ad_id: string
  ad_name: string
  adset_id?: string | null
  adset_name?: string | null
  campaign_id: string
  campaign_name: string
  objective?: string | null
  date_start: string
  date_stop?: string | null
  spend?: string | number | null
  impressions?: string | number | null
  clicks?: string | number | null
  reach?: string | number | null
  frequency?: string | number | null
  ctr?: string | number | null
  cpc?: string | number | null
  cpm?: string | number | null
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toDateOnlyUTC(isoString: string): Date {
  const d = new Date(isoString)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.META_WEBHOOK_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get("x-webhook-secret")
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  return headerSecret === expected || querySecret === expected
}

function normalizeRows(body: unknown): MetaAdInsightRow[] {
  if (Array.isArray(body)) return body as MetaAdInsightRow[]
  if (body && typeof body === "object") {
    const maybeData = (body as Record<string, unknown>).data
    if (Array.isArray(maybeData)) return maybeData as MetaAdInsightRow[]
    return [body as MetaAdInsightRow]
  }
  return []
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

  const allRows = normalizeRows(body).filter((row) => row.ad_id && row.campaign_id)
  const rowErrors: string[] = []

  // Reject rows spanning more than one calendar day: this schema stores one
  // spend/impressions/clicks total per (ad, day), so a multi-day aggregate row
  // (e.g. Meta's Insights API without "time_increment=1") would silently get
  // filed under a single day, wildly overstating that one day and understating
  // the rest. Fail loudly instead — this needs "Time Increment = 1" set on the
  // Make Insights module, not a partial write here.
  const rows = allRows.filter((row) => {
    if (!row.date_stop) return true
    const spansMultipleDays = row.date_start.slice(0, 10) !== row.date_stop.slice(0, 10)
    if (spansMultipleDays) {
      rowErrors.push(
        `ad ${row.ad_id}: row spans multiple days (${row.date_start.slice(0, 10)} to ${row.date_stop.slice(0, 10)}) — set "Time Increment = 1" in the Make Insights module, skipping this row`,
      )
    }
    return !spansMultipleDays
  })

  // Dedupe by key before firing parallel upserts, so two rows for the same
  // campaign/ad/day never race against each other — last one wins, matching
  // sequential processing order.
  const campaignsByMetaId = new Map<string, MetaAdInsightRow>()
  const adsByMetaId = new Map<string, MetaAdInsightRow>()
  for (const row of rows) {
    campaignsByMetaId.set(row.campaign_id, row)
    adsByMetaId.set(row.ad_id, row)
  }

  const campaignIdByMetaId = new Map<string, string>()
  await Promise.all(
    [...campaignsByMetaId.entries()].map(async ([metaCampaignId, row]) => {
      try {
        const campaign = await prisma.campaign.upsert({
          where: { metaCampaignId },
          update: { name: row.campaign_name ?? "Sem nome", objective: row.objective ?? undefined },
          create: {
            metaCampaignId,
            name: row.campaign_name ?? "Sem nome",
            objective: row.objective ?? undefined,
          },
        })
        campaignIdByMetaId.set(metaCampaignId, campaign.id)
      } catch (e) {
        rowErrors.push(`campaign ${metaCampaignId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }),
  )

  const adIdByMetaId = new Map<string, string>()
  await Promise.all(
    [...adsByMetaId.entries()].map(async ([metaAdId, row]) => {
      const campaignId = campaignIdByMetaId.get(row.campaign_id)
      if (!campaignId) {
        rowErrors.push(`ad ${metaAdId}: campaign ${row.campaign_id} failed to upsert, skipping`)
        return
      }
      try {
        const ad = await prisma.ad.upsert({
          where: { metaAdId },
          update: {
            name: row.ad_name ?? "Sem nome",
            adsetId: row.adset_id ?? undefined,
            adsetName: row.adset_name ?? undefined,
            campaignId,
          },
          create: {
            metaAdId,
            name: row.ad_name ?? "Sem nome",
            adsetId: row.adset_id ?? undefined,
            adsetName: row.adset_name ?? undefined,
            campaignId,
          },
        })
        adIdByMetaId.set(metaAdId, ad.id)
      } catch (e) {
        rowErrors.push(`ad ${metaAdId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }),
  )

  // Insight rows are keyed by (ad, day) — dedupe the same way in case the
  // batch has more than one row for the same ad on the same day.
  const insightsByKey = new Map<string, MetaAdInsightRow>()
  for (const row of rows) {
    insightsByKey.set(`${row.ad_id}__${row.date_start.slice(0, 10)}`, row)
  }

  let processed = 0
  await Promise.all(
    [...insightsByKey.values()].map(async (row) => {
      const adId = adIdByMetaId.get(row.ad_id)
      if (!adId) {
        rowErrors.push(`insight for ad ${row.ad_id}: ad failed to upsert, skipping`)
        return
      }
      try {
        const date = toDateOnlyUTC(row.date_start)
        const spend = toNumber(row.spend)
        const impressions = Math.round(toNumber(row.impressions))
        const clicks = Math.round(toNumber(row.clicks))
        const reach = Math.round(toNumber(row.reach))
        const frequency = toNumber(row.frequency)
        const ctr = toNumber(row.ctr)
        const cpc = toNumber(row.cpc)
        const cpm = toNumber(row.cpm)

        await prisma.adInsightDaily.upsert({
          where: { adId_date: { adId, date } },
          update: { spend, impressions, clicks, reach, frequency, ctr, cpc, cpm },
          create: { adId, date, spend, impressions, clicks, reach, frequency, ctr, cpc, cpm },
        })
        processed++
      } catch (e) {
        rowErrors.push(`insight for ad ${row.ad_id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }),
  )

  await prisma.syncRun.create({
    data: {
      source: SyncSource.META,
      finishedAt: new Date(),
      status: rowErrors.length === 0 ? SyncStatus.SUCCESS : SyncStatus.ERROR,
      rowsProcessed: processed,
      errorMessage: rowErrors.length > 0 ? rowErrors.slice(0, 10).join(" | ") : undefined,
    },
  })

  return NextResponse.json({ ok: true, processed, totalRows: rows.length, errors: rowErrors })
}
