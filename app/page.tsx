'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { PublishingStatus, ScheduleStatus, Platform } from '@/lib/types'
import { getSchedulePublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'
import { useChannelFilter } from '@/components/ChannelFilterContext'

type StatCounts = {
  todayQueue: number
  scheduled: number
  published: number
  failed: number
}

type UpcomingItem = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  status: PublishingStatus
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCounts | null>(null)
  const [todayItems, setTodayItems] = useState<UpcomingItem[]>([])
  const [weekItems, setWeekItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  const { channelFilter } = useChannelFilter()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()

      const [{ data: allSchedulesData }, { data: schedulesData }] = await Promise.all([
        supabase.from('cmp_schedules').select('content_item_id, platform, status, scheduled_at'),
        supabase
          .from('cmp_schedules')
          .select('id, content_item_id, platform, status, scheduled_at, cmp_content_items(id, title)')
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfWeek)
          .eq('status', 'pending')
          .order('scheduled_at'),
      ])

      const filteredAllSchedules =
        channelFilter === 'all'
          ? (allSchedulesData ?? [])
          : (allSchedulesData ?? []).filter((schedule) => schedule.platform === channelFilter)

      const counts: StatCounts = {
        todayQueue: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
      }
      for (const schedule of filteredAllSchedules) {
        const displayStatus = getSchedulePublishingStatus(schedule.status as ScheduleStatus)
        const scheduledAt = new Date(schedule.scheduled_at)
        const isToday = scheduledAt >= new Date(startOfDay) && scheduledAt < new Date(endOfDay)

        if (displayStatus === 'scheduled') {
          counts.scheduled += 1
          if (isToday) counts.todayQueue += 1
        } else if (displayStatus === 'published') {
          counts.published += 1
        } else if (displayStatus === 'failed') {
          counts.failed += 1
        }
      }
      setStats(counts)

      const today: UpcomingItem[] = []
      const week: UpcomingItem[] = []
      const filteredSchedules =
        channelFilter === 'all'
          ? (schedulesData ?? [])
          : (schedulesData ?? []).filter((schedule) => schedule.platform === channelFilter)

      for (const s of filteredSchedules) {
        const content = Array.isArray(s.cmp_content_items) ? s.cmp_content_items[0] : s.cmp_content_items
        if (!content) continue
        const item: UpcomingItem = {
          id: content.id,
          title: content.title,
          platform: s.platform as Platform,
          scheduled_at: s.scheduled_at,
          status: getSchedulePublishingStatus(s.status as ScheduleStatus),
        }
        if (s.scheduled_at < endOfDay) today.push(item)
        else week.push(item)
      }
      setTodayItems(today)
      setWeekItems(week)
      setLoading(false)
    }
    load()
  }, [channelFilter])

  const statCards = [
    { label: 'คิววันนี้', key: 'todayQueue' as const, tone: 'text-slate-700' },
    { label: 'กำหนดแล้ว', key: 'scheduled' as const, tone: 'text-violet-600' },
    { label: 'เผยแพร่แล้ว', key: 'published' as const, tone: 'text-emerald-600' },
    { label: 'โพสต์ไม่สำเร็จ', key: 'failed' as const, tone: 'text-red-600' },
  ]

  return (
    <>
      <section className="page-header">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">ภาพรวม</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              Evergreen Farming CMP
            </div>
            <Link href="/content/new" className="primary-button px-4 py-2.5 text-sm font-semibold">
              + Create Post
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, key, tone }) => (
          <article key={key} className="surface-card p-5">
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <strong className={`mt-3 block text-[2rem] font-semibold ${tone}`}>
              {loading ? '—' : (stats?.[key] ?? 0)}
            </strong>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ScheduleList title="โพสต์วันนี้" items={todayItems} loading={loading} emptyText="ไม่มีโพสต์วันนี้" />
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
    <section className="surface-card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <Link href="/planner" className="text-sm font-medium text-[var(--brand)]">
          ดูทั้งหมด →
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id + item.scheduled_at}
              href={`/content/${item.id}`}
              className="surface-muted flex items-center justify-between gap-4 p-4 transition-colors hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlatformIcon platform={item.platform} />
                <span className="truncate text-sm font-medium text-slate-900">{item.title}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
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
