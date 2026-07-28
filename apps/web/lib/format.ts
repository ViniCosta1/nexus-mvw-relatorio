export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`
}

export function formatRoas(value: number): string {
  return `${value.toFixed(1)}x`
}
