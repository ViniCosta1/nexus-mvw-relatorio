import { google } from "googleapis"

export function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
  return google.sheets({ version: "v4", auth })
}

export async function fetchSheetRows(range: string): Promise<string[][]> {
  const sheets = getSheetsClient()
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID not set")

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values ?? []) as string[][]
}

/** Parses Brazilian currency/number formats. "Gratuito" (or any non-numeric text) is treated as 0. */
export function parseValorBR(raw: string | undefined): number {
  if (!raw) return 0
  const trimmed = raw.trim()
  if (!/[0-9]/.test(trimmed)) return 0
  const cleaned = trimmed.replace(/[^0-9,.-]/g, "")
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", ".")) || 0
  }
  return Number(cleaned) || 0
}

/** Parses dd/mm/yy or dd/mm/yyyy into a UTC-midnight Date. */
export function parseDataBR(raw: string | undefined): Date | null {
  if (!raw) return null
  const parts = raw.trim().split("/")
  if (parts.length !== 3) return null
  const [dStr, mStr, yStr] = parts
  const d = Number(dStr)
  const m = Number(mStr)
  let y = Number(yStr)
  if (!d || !m || !y) return null
  if (y < 100) y += 2000
  const date = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(date.getTime()) ? null : date
}
