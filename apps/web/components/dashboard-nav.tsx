"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChartBar, List, Megaphone, Users } from "@phosphor-icons/react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet"

const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: ChartBar },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/vendas", label: "Vendas & Clientes", icon: Users },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
    </>
  )
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="mb-6 flex items-center gap-2 px-2">
        {/* Logo art is white text + green mark on transparent. On the light sidebar
            the white text would vanish, so invert+hue-rotate flips it to dark text
            while keeping the green mark green. */}
        <Image
          src="/logo-mvw.webp"
          alt="MVW"
          width={120}
          height={36}
          className="h-9 w-auto invert hue-rotate-180"
        />
      </div>
      <NavLinks onNavigate={onNavigate} />
    </>
  )
}

/** Permanent sidebar, visible from `md` breakpoint up. */
export function DashboardNav() {
  return (
    <nav className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden min-h-svh w-60 shrink-0 flex-col gap-1 self-stretch border-r p-4 md:flex">
      <NavContent />
    </nav>
  )
}

/** Mobile header bar with logo + hamburger button that opens the nav in a Sheet, visible below `md`. */
export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex items-center justify-between border-b p-4 md:hidden">
      <Image src="/logo-mvw.webp" alt="MVW" width={100} height={30} className="h-7 w-auto invert hue-rotate-180" />
      <Sheet open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <List size={20} />
        </Button>
        <SheetContent side="left" className="bg-sidebar text-sidebar-foreground flex flex-col gap-1 p-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
