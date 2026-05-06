'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'
import { ChannelFilterProvider } from '@/components/ChannelFilterContext'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('cmp-sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem('cmp-sidebar-collapsed', String(collapsed))
  }, [collapsed, ready])

  return (
    <ChannelFilterProvider>
      <div className={`app-shell ${collapsed ? 'app-shell-collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <MainPanel>{children}</MainPanel>
      </div>
    </ChannelFilterProvider>
  )
}
