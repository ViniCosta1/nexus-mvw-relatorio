import { NextResponse } from "next/server"
import { SyncSource, SyncStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { fetchSheetRows, parseDataBR, parseValorBR } from "@/lib/sheets"

const SHEET_RANGE = "Vendas!A2:I"

// Column order in the "Vendas" tab (row 1 header, confirmed against the real sheet):
// Produto, Cliente/Nome, Cliente/Email, Cliente/Número, DDD, Cliente/CPF, Data, Valor, Vendedor
const COL = {
  produto: 0,
  clienteNome: 1,
  clienteEmail: 2,
  clienteNumero: 3,
  ddd: 4,
  clienteCpf: 5,
  data: 6,
  valor: 7,
  vendedor: 8,
} as const

function isAuthorized(request: Request): boolean {
  const expected = process.env.SYNC_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get("x-sync-secret")
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  return headerSecret === expected || querySecret === expected
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let rows: string[][]
  try {
    rows = await fetchSheetRows(SHEET_RANGE)
  } catch (e) {
    await prisma.syncRun.create({
      data: {
        source: SyncSource.SHEETS,
        finishedAt: new Date(),
        status: SyncStatus.ERROR,
        rowsProcessed: 0,
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    })
    return NextResponse.json({ ok: false, error: "failed to read sheet" }, { status: 502 })
  }

  const rowErrors: string[] = []
  let processed = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    // Data-driven row number (header is row 1, data starts at row 2) — used as the
    // dedupe key since this sheet has no ID column. Rows must stay append-only;
    // deleting/reordering rows in the middle will shift identity for rows after it.
    const rowNumber = i + 2

    try {
      const clientName = row[COL.clienteNome]?.trim()
      const saleDate = parseDataBR(row[COL.data])
      if (!clientName || !saleDate) {
        rowErrors.push(`row ${rowNumber}: missing client name or unparseable date`)
        continue
      }

      const amount = parseValorBR(row[COL.valor])
      const externalId = `greenn-sheets-row-${rowNumber}`

      await prisma.sale.upsert({
        where: { externalId },
        update: {
          clientName,
          clientEmail: row[COL.clienteEmail]?.trim() || null,
          clientPhone: row[COL.clienteNumero]?.trim() || null,
          sellerName: row[COL.vendedor]?.trim() || "Não informado",
          productName: row[COL.produto]?.trim() || "Não informado",
          amount,
          saleDate,
          channel: "Não atribuído",
          rawRow: row as unknown as object,
        },
        create: {
          externalId,
          clientName,
          clientEmail: row[COL.clienteEmail]?.trim() || null,
          clientPhone: row[COL.clienteNumero]?.trim() || null,
          sellerName: row[COL.vendedor]?.trim() || "Não informado",
          productName: row[COL.produto]?.trim() || "Não informado",
          amount,
          saleDate,
          channel: "Não atribuído",
          rawRow: row as unknown as object,
        },
      })

      processed++
    } catch (e) {
      rowErrors.push(`row ${rowNumber}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await prisma.syncRun.create({
    data: {
      source: SyncSource.SHEETS,
      finishedAt: new Date(),
      status: rowErrors.length === 0 ? SyncStatus.SUCCESS : SyncStatus.ERROR,
      rowsProcessed: processed,
      errorMessage: rowErrors.length > 0 ? rowErrors.slice(0, 10).join(" | ") : undefined,
    },
  })

  return NextResponse.json({ ok: true, processed, totalRows: rows.length, errors: rowErrors })
}
