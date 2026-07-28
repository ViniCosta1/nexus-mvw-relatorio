"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChartBar, Megaphone, Users } from "@phosphor-icons/react"
import { cn } from "@workspace/ui/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: ChartBar },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/vendas", label: "Vendas & Clientes", icon: Users },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-sidebar text-sidebar-foreground flex h-full w-60 shrink-0 flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Image src="/logo-mvw.webp" alt="MVW" width={120} height={36} className="h-9 w-auto" />
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon size={18} weight={active ? "fill" : "regular"} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
