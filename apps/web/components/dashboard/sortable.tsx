"use client"

import { useMemo, useState } from "react"
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react"
import { TableHead } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

export type SortState<T> = { key: keyof T; dir: "asc" | "desc" } | null

/** Client-side sort over already-loaded rows; first click on a column sorts descending. */
export function useSortedRows<T>(rows: T[]) {
  const [sort, setSort] = useState<SortState<T>>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const { key, dir } = sort
    return [...rows].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      const c =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR")
      return dir === "asc" ? c : -c
    })
  }, [rows, sort])
  const onSort = (key: keyof T) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
  return { sorted, sort, onSort }
}

export function SortHeader<T>({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string
  sortKey: keyof T
  sort: SortState<T>
  onSort: (key: keyof T) => void
  align?: "right"
}) {
  const active = sort?.key === sortKey
  const Icon = !active ? CaretUpDown : sort!.dir === "asc" ? CaretUp : CaretDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 select-none",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon size={12} weight="bold" className={cn("shrink-0", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  )
}
