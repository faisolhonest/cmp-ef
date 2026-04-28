'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mainNav = [
  { href: '/', icon: 'home', label: 'ภาพรวม' },
  { href: '/planner', icon: 'calendar', label: 'ปฏิทินคอนเทนต์' },
  { href: '/content', icon: 'folder', label: 'คลังคอนเทนต์' },
]

const workspaceNav = [
  { href: '/campaigns', icon: 'flag', label: 'แคมเปญ' },
  { href: '/analytics', icon: 'chart', label: 'Analytics' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <span className="text-sm font-semibold tracking-[0.12em] text-white">CMP</span>
        </div>
        <div>
          <p className="text-[1.05rem] font-semibold leading-tight">CMP</p>
          <p className="mt-0.5 text-xs text-slate-400">Evergreen Farming</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="sidebar-section-title">Main</p>
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="sidebar-section-title">Workspace</p>
        {workspaceNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="sidebar-footer">
        <p className="mb-1 text-sm font-semibold">Evergreen Farming</p>
        <p className="text-xs leading-relaxed text-slate-400">
          Content Management Platform
        </p>
      </div>
    </aside>
  )
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}>
      <span className="sidebar-icon">
        <NavIcon icon={icon} />
      </span>
      {label}
    </Link>
  )
}

function NavIcon({ icon }: { icon: string }) {
  const className = 'nav-svg'

  switch (icon) {
    case 'home':
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z" /></svg>
    case 'calendar':
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
    case 'folder':
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" /></svg>
    case 'flag':
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 21V4m0 0c4-2 6 2 10 0v9c-4 2-6-2-10 0" /></svg>
    case 'chart':
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19h16M7 16V9m5 7V5m5 11v-6" /></svg>
    default:
      return <svg viewBox="0 0 24 24" width="16" height="16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="7" /></svg>
  }
}
