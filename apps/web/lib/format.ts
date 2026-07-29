export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`
}

export function formatRoas(value: number): string {
  return `${value.toFixed(1)}x`
}

/**
 * Formats a UTC-midnight date as dd/mm using the UTC calendar day, avoiding
 * the off-by-one that occurs in negative-UTC-offset timezones (e.g. Brazil)
 * when `toLocaleDateString` is called without a `timeZone` option.
 */
export function formatDateBR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
}

/**
 * Formats a UTC-midnight date using pt-BR's default long form, pinned to the
 * UTC calendar day so it matches the date the underlying data represents.
 */
export function formatDateLongBR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

/** Formats a `YYYY-MM` key as "junho de 2026". */
export function formatMonthBR(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Formats a UTC-midnight date in full written form, e.g. "1 de junho de 2026". */
export function formatDateFullBR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}
