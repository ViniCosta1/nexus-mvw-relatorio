"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

const PRESETS = [
  { label: "30 dias", days: 30 },
  { label: "60 dias", days: 60 },
  { label: "90 dias", days: 90 },
]

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function FilterBar({ activeDays, from, to }: { activeDays: number; from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams],
  )

  function applyPreset(days: number) {
    const toDate = new Date()
    toDate.setUTCHours(0, 0, 0, 0)
    const fromDate = new Date(toDate)
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", toISODate(fromDate))
    params.set("to", toISODate(toDate))
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", customFrom)
    params.set("to", customTo)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParam("q", search || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              type="button"
              size="sm"
              variant={p.days === activeDays ? "default" : "outline"}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </Button>
          ))}
          <span className="text-muted-foreground px-1 text-sm">ou período:</span>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
          <Button type="button" size="sm" variant="secondary" onClick={applyCustomRange}>
            Aplicar
          </Button>
        </div>
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
      </div>
    </div>
  )
}
