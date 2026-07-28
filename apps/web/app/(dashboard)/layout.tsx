import { DashboardNav } from "@/components/dashboard-nav"

export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <DashboardNav />
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
    </div>
  )
}
