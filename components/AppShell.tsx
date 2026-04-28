import Sidebar from '@/components/Sidebar'
import MainPanel from '@/components/MainPanel'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <MainPanel>{children}</MainPanel>
    </div>
  )
}
