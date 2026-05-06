'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CHANNEL_OPTIONS, useChannelFilter, type ChannelFilter } from '@/components/ChannelFilterContext'
import PlatformIcon from '@/components/PlatformIcon'

const mainNav = [
  { href: '/', icon: 'home', label: 'ภาพรวม' },
  { href: '/planner', icon: 'calendar', label: 'ปฏิทินคอนเทนต์' },
  { href: '/content', icon: 'folder', label: 'คลังคอนเทนต์' },
]

const brandLogoUrl = 'https://onlingothailand.com/superawesome/2020/08/cropped-Untitled-1.png'

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const { channelFilter, setChannelFilter } = useChannelFilter()
  const [channelsOpen, setChannelsOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className={`sidebar-shell ${collapsed ? 'sidebar-shell-collapsed' : ''}`}>
      <div className="sidebar-topbar">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="sidebar-brand-toggle"
            aria-label="Expand sidebar"
            aria-pressed={collapsed}
            title="Expand sidebar"
          >
            <BrandLogo />
          </button>
        ) : (
          <>
            <div className="sidebar-brand">
              <div className="sidebar-brand-mark">
                <BrandLogo />
              </div>
              <div className="sidebar-copy">
                <p className="sidebar-brand-title">OnlinGo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="sidebar-toggle"
              aria-label="Collapse sidebar"
              aria-pressed={collapsed}
              title="Collapse sidebar"
            >
              <ToggleIcon collapsed={collapsed} />
            </button>
          </>
        )}
      </div>

      <div className="sidebar-nav-section">
        <p className={`sidebar-section-title ${collapsed ? 'sidebar-section-title-hidden' : ''}`}>Main</p>
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </div>

      <div className="sidebar-nav-section">
        <p className={`sidebar-section-title ${collapsed ? 'sidebar-section-title-hidden' : ''}`}>Workspace</p>
        <NavItem href="/campaigns" icon="flag" label="แคมเปญ" active={isActive('/campaigns')} collapsed={collapsed} />
        <ChannelFilterSection
          collapsed={collapsed}
          open={channelsOpen}
          value={channelFilter}
          onToggle={() => setChannelsOpen((open) => !open)}
          onChange={setChannelFilter}
        />
        <NavItem href="/analytics" icon="chart" label="Analytics" active={isActive('/analytics')} collapsed={collapsed} />
      </div>
    </aside>
  )
}

function BrandLogo() {
  return (
    <span
      role="img"
      aria-label="OnlinGo"
      className="sidebar-brand-image"
      style={{ backgroundImage: `url(${brandLogoUrl})` }}
    />
  )
}

function ChannelFilterSection({
  collapsed,
  open,
  value,
  onToggle,
  onChange,
}: {
  collapsed: boolean
  open: boolean
  value: ChannelFilter
  onToggle: () => void
  onChange: (value: ChannelFilter) => void
}) {
  const active = open || value !== 'all'

  return (
    <div className={`sidebar-channel-accordion ${collapsed ? 'sidebar-channel-accordion-collapsed' : ''}`}>
      <button
        type="button"
        className={`sidebar-channel-trigger ${active ? 'sidebar-channel-trigger-active' : ''} ${collapsed ? 'sidebar-channel-trigger-collapsed' : ''}`}
        onClick={onToggle}
        title="ช่องทาง"
        aria-label="ช่องทาง"
        aria-expanded={open}
        data-label="ช่องทาง"
      >
        <span className="sidebar-icon">
          <AllChannelsIcon />
        </span>
        <span className={`sidebar-copy ${collapsed ? 'sidebar-copy-hidden' : ''}`}>ช่องทาง</span>
        <svg viewBox="0 0 20 20" className={`sidebar-channel-chevron ${open ? 'sidebar-channel-chevron-open' : ''} ${collapsed ? 'sidebar-copy-hidden' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className={`sidebar-channel-list ${collapsed ? 'sidebar-channel-list-collapsed' : ''}`}>
        {CHANNEL_OPTIONS.map((option) => {
          const optionActive = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={`sidebar-channel-button ${optionActive ? 'sidebar-channel-button-active' : ''} ${collapsed ? 'sidebar-channel-button-collapsed' : ''}`}
              onClick={() => onChange(option.value)}
              title={option.label}
              aria-label={option.label}
              aria-pressed={optionActive}
              data-label={option.label}
            >
              <span className="sidebar-channel-icon">
                {option.platform ? <PlatformIcon platform={option.platform} /> : <AllChannelsIcon />}
              </span>
              <span className={`sidebar-copy ${collapsed ? 'sidebar-copy-hidden' : ''}`}>{option.label}</span>
            </button>
          )
        })}
        </div>
      )}
    </div>
  )
}

function AllChannelsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h7M13 7h7M4 12h16M4 17h7M13 17h7" />
    </svg>
  )
}

function NavItem({ href, icon, label, active, collapsed }: { href: string; icon: string; label: string; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      className={`sidebar-link ${active ? 'sidebar-link-active' : ''} ${collapsed ? 'sidebar-link-collapsed' : ''}`}
      title={label}
      aria-label={label}
      data-label={label}
    >
      <span className="sidebar-icon">
        <NavIcon icon={icon} />
      </span>
      <span className={`sidebar-copy ${collapsed ? 'sidebar-copy-hidden' : ''}`}>{label}</span>
    </Link>
  )
}

function ToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="nav-svg" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d={collapsed ? 'M8 6.5v7' : 'M12 6.5v7'} />
      <path d={collapsed ? 'm12 10-2-2m2 2-2 2' : 'm8 10 2-2m-2 2 2 2'} />
    </svg>
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
