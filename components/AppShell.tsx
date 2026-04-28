'use client'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'

const FULLBLEED_ROUTES = ['/planner']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullBleed = FULLBLEED_ROUTES.includes(pathname)

  return (
    <div className={fullBleed ? 'app-shell app-shell-fullbleed' : 'app-shell'}>
      <Sidebar />
      <MainPanel>{children}</MainPanel>
    </div>
  )
}
