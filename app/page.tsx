'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

type StatCounts = Record<ContentStatus, number>

type UpcomingItem = {
  id: string
  title: string
  platform: string
  scheduled_at: string
  status: ContentStatus
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCounts | null>(null)
  const [todayItems, setTodayItems] = useState<UpcomingItem[]>([])
  const [weekItems, setWeekItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()

      const [{ data: contentData }, { data: schedulesData }] = await Promise.all([
        supabase.from('cmp_content_items').select('status'),
        supabase
          .from('cmp_schedules')
          .select('id, content_item_id, platform, scheduled_at, cmp_content_items(id, title, status)')
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfWeek)
          .eq('status', 'pending')
          .order('scheduled_at'),
      ])

      // Count by status
      const counts = {} as StatCounts
      for (const item of contentData ?? []) {
        counts[item.status as ContentStatus] = (counts[item.status as ContentStatus] ?? 0) + 1
      }
      setStats(counts)

      // Split today vs rest of week
      const today: UpcomingItem[] = []
      const week: UpcomingItem[] = []
      for (const s of schedulesData ?? []) {
        const content = Array.isArray(s.cmp_content_items) ? s.cmp_content_items[0] : s.cmp_content_items
        if (!content) continue
        const item: UpcomingItem = {
          id: content.id,
          title: content.title,
          platform: s.platform,
          scheduled_at: s.scheduled_at,
          status: content.status as ContentStatus,
        }
        if (s.scheduled_at < endOfDay) today.push(item)
        else week.push(item)
      }
      setTodayItems(today)
      setWeekItems(week)
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: 'ร่าง', key: 'draft' as ContentStatus, color: '#6f7d96' },
    { label: 'อนุมัติแล้ว', key: 'approved' as ContentStatus, color: '#2f66ff' },
    { label: 'กำหนดแล้ว', key: 'scheduled' as ContentStatus, color: '#8f6bff' },
    { label: 'เผยแพร่แล้ว', key: 'published' as ContentStatus, color: '#1fbf75' },
  ]

  return (
    <>
      {/* Topbar */}
      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '26px',
          padding: '18px 22px',
          backdropFilter: 'blur(18px)',
        }}
      >
        <h2 className="text-[1.5rem] font-bold leading-tight">ภาพรวม</h2>
        <p className="text-[var(--muted)] text-sm mt-1">
          {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, key, color }) => (
          <article
            key={key}
            style={{
              background: 'var(--panel)',
              border: '1px solid rgba(255,255,255,0.78)',
              borderRadius: '22px',
              padding: '18px',
              boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
            }}
          >
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <strong className="block text-[2rem] mt-2" style={{ color }}>
              {loading ? '—' : (stats?.[key] ?? 0)}
            </strong>
          </article>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Today */}
        <ScheduleList title="โพสต์วันนี้" items={todayItems} loading={loading} emptyText="ไม่มีโพสต์วันนี้" />
        {/* This week */}
        <ScheduleList title="สัปดาห์นี้" items={weekItems} loading={loading} emptyText="ไม่มีโพสต์สัปดาห์นี้" />
      </div>
    </>
  )
}

function ScheduleList({
  title,
  items,
  loading,
  emptyText,
}: {
  title: string
  items: UpcomingItem[]
  loading: boolean
  emptyText: string
}) {
  return (
    <section
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(255,255,255,0.78)',
        borderRadius: '22px',
        padding: '20px',
        boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
      }}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{title}</h3>
        <Link href="/planner" className="text-xs text-[var(--brand)] font-semibold">
          ดูทั้งหมด →
        </Link>
      </div>
      {loading ? (
        <p className="text-[var(--muted)] text-sm">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--muted)] text-sm">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id + item.scheduled_at}
              href={`/content/${item.id}`}
              className="flex items-center justify-between gap-3 p-3 rounded-[14px] border border-[var(--line)] hover:bg-blue-50/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <PlatformIcon platform={item.platform as any} />
                <span className="text-sm font-medium truncate">{item.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[var(--muted)]">
                  {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <StatusBadge status={item.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
