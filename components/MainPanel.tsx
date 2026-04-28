'use client'
import { usePathname } from 'next/navigation'

const FULLBLEED_ROUTES = ['/planner']

export default function MainPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullBleed = FULLBLEED_ROUTES.includes(pathname)

  return (
    <main className={fullBleed ? 'main-panel-fullbleed' : 'main-panel'}>
      {children}
    </main>
  )
}
