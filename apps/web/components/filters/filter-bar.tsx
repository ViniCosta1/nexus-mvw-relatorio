"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

const PRESETS = [
  { label: "30 dias", days: 30 },
  { label: "60 dias", days: 60 },
]

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  // Keep the date inputs in sync with the active range, so clicking a preset (or
  // any navigation that changes from/to) also updates what the inputs show.
  useEffect(() => {
    setCustomFrom(from)
    setCustomTo(to)
  }, [from, to])

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
    const range = presetRange(days, todayISO, accountStartDay)
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", range.from)
    params.set("to", range.to)
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
          {PRESETS.map((p) => {
            const range = presetRange(p.days, todayISO, accountStartDay)
            const active = range.from === from && range.to === to
            return (
              <Button
                key={p.days}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => applyPreset(p.days)}
              >
                {p.label}
              </Button>
            )
          })}
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
      </div>
    </div>
  )
}
