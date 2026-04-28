'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mainNav = [
  { href: '/', icon: '⌂', label: 'ภาพรวม' },
  { href: '/planner', icon: '▦', label: 'ปฏิทินคอนเทนต์' },
  { href: '/content', icon: '✎', label: 'คลังคอนเทนต์' },
]

const workspaceNav = [
  { href: '/campaigns', icon: '⚙', label: 'แคมเปญ' },
  { href: '/analytics', icon: '△', label: 'Analytics' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside
      className="text-[#f4f7ff] p-7 flex flex-col gap-[18px]"
      style={{
        background: 'linear-gradient(180deg, #081c3f 0%, #0b295d 58%, #0d1c3d 100%)',
        minHeight: 'calc(100vh - 48px)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-2.5 pb-5 border-b border-white/10">
        <div
          className="w-[34px] h-[34px] rounded-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #74a7ff, #8a66ff 60%, #37d5c7)',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)',
          }}
        />
        <div>
          <p className="font-bold text-[1.05rem] leading-tight">CMP</p>
          <p className="text-xs text-[rgba(244,247,255,0.55)] mt-0.5">Evergreen Farming</p>
        </div>
      </div>

      {/* Main nav */}
      <div className="flex flex-col gap-1.5">
        <p className="px-2.5 text-[0.75rem] text-[rgba(244,247,255,0.45)] uppercase tracking-widest mb-1">
          Main
        </p>
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      {/* Workspace nav */}
      <div className="flex flex-col gap-1.5">
        <p className="px-2.5 text-[0.75rem] text-[rgba(244,247,255,0.45)] uppercase tracking-widest mb-1">
          Workspace
        </p>
        {workspaceNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto rounded-[18px] p-4 bg-white/[0.07] border border-white/[0.07]">
        <p className="text-sm font-semibold mb-1">Evergreen Farming</p>
        <p className="text-xs text-[rgba(244,247,255,0.6)] leading-relaxed">
          Content Management Platform
        </p>
      </div>
    </aside>
  )
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] text-[0.95rem] text-[rgba(244,247,255,0.88)] transition-all duration-180"
      style={
        active
          ? {
              background: 'linear-gradient(90deg, rgba(68,113,255,0.28), rgba(255,255,255,0.08))',
              transform: 'translateX(2px)',
            }
          : undefined
      }
    >
      <span
        className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[0.9rem] flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {icon}
      </span>
      {label}
    </Link>
  )
}
