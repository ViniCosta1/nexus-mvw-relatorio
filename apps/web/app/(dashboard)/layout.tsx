import { DashboardNav, MobileNav } from "@/components/dashboard-nav"

export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <DashboardNav />
      <MobileNav />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  )
}
