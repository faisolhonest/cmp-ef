'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Platform, ContentStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

type CalendarItem = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  status: ContentStatus
  content_item_id: string
  campaign_id: string | null
  campaign_name: string | null
  caption_main: string | null
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const PLATFORM_STYLE: Record<Platform, string> = {
  fb: 'border-blue-100 bg-blue-50/80',
  ig: 'border-fuchsia-100 bg-fuchsia-50/70',
  tiktok: 'border-slate-200 bg-slate-50',
  youtube: 'border-rose-100 bg-rose-50/80',
  shopee: 'border-orange-100 bg-orange-50/80',
  other: 'border-slate-200 bg-slate-50',
}

const ALL_STATUSES: ContentStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published']

export default function PlannerPage() {
  const [view, setView] = useState<'calendar' | 'kanban' | 'timeline'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    setLoading(true)
    setSelectedDay(null)
    const startOfMonth = new Date(year, month, 1).toISOString()
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    supabase
      .from('cmp_schedules')
      .select(`
        id, content_item_id, platform, scheduled_at,
        cmp_content_items(id, title, caption_main, status, campaign_id,
          cmp_campaigns(id, name))
      `)
      .gte('scheduled_at', startOfMonth)
      .lte('scheduled_at', endOfMonth)
      .order('scheduled_at')
      .then(({ data }) => {
        setItems(
          (data ?? []).map((s: any) => {
            const content = Array.isArray(s.cmp_content_items) ? s.cmp_content_items[0] : s.cmp_content_items
            const campaign = content?.cmp_campaigns
              ? (Array.isArray(content.cmp_campaigns) ? content.cmp_campaigns[0] : content.cmp_campaigns)
              : null
            return {
              id: s.id,
              content_item_id: s.content_item_id,
              platform: s.platform as Platform,
              scheduled_at: s.scheduled_at,
              title: content?.title ?? '(ไม่มีชื่อ)',
              caption_main: content?.caption_main ?? null,
              status: (content?.status ?? 'draft') as ContentStatus,
              campaign_id: content?.campaign_id ?? null,
              campaign_name: campaign?.name ?? null,
            }
          })
        )
        setLoading(false)
      })
  }, [year, month])

  useEffect(() => {
    if (selectedDay === null) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedDay(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedDay])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const itemsByDay: Record<number, CalendarItem[]> = {}
  for (const item of items) {
    const d = new Date(item.scheduled_at).getDate()
    if (!itemsByDay[d]) itemsByDay[d] = []
    itemsByDay[d].push(item)
  }

  const selectedDayItems = selectedDay !== null ? (itemsByDay[selectedDay] ?? []) : []

  return (
    <>
      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">ปฏิทินคอนเทนต์</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">วางแผนและติดตามสถานะโพสต์ทุกช่องทาง</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="secondary-button flex h-10 w-10 items-center justify-center text-sm">
                ‹
              </button>
              <span className="min-w-[128px] text-center text-sm font-semibold text-slate-900">
                {MONTHS_TH[month]} {year + 543}
              </span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="secondary-button flex h-10 w-10 items-center justify-center text-sm">
                ›
              </button>
            </div>
            <div className="segmented-control">
              {(['calendar', 'kanban', 'timeline'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className="segmented-option text-sm" data-active={view === v}>
                  {v === 'calendar' ? 'Calendar' : v === 'kanban' ? 'Kanban' : 'Timeline'}
                </button>
              ))}
            </div>
            <Link href="/content/new" className="primary-button px-4 py-2.5 text-center text-sm font-semibold">
              + เพิ่มกิจกรรม
            </Link>
          </div>
        </div>
      </section>

      {view === 'calendar' && (
        <CalendarView
          loading={loading}
          itemsByDay={itemsByDay}
          firstDay={firstDay}
          daysInMonth={daysInMonth}
          year={year}
          month={month}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}

      {view === 'kanban' && <KanbanView items={items} loading={loading} />}

      {view === 'timeline' && (
        <TimelineView items={items} loading={loading} daysInMonth={daysInMonth} year={year} month={month} today={today} />
      )}

      {selectedDay !== null && (
        <DayDetailModal
          day={selectedDay}
          month={month}
          year={year}
          items={selectedDayItems}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>
  )
}

function CalendarView({
  loading, itemsByDay, firstDay, daysInMonth, year, month, today, selectedDay, onSelectDay,
}: {
  loading: boolean
  itemsByDay: Record<number, CalendarItem[]>
  firstDay: number
  daysInMonth: number
  year: number
  month: number
  today: Date
  selectedDay: number | null
  onSelectDay: (day: number) => void
}) {
  return (
    <section className="surface-card p-4 md:p-6">
      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--muted)]">กำลังโหลด...</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="rounded-[12px] bg-[var(--panel-soft)] py-3 text-center text-sm text-[var(--muted)]">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="hidden min-h-[138px] rounded-[16px] border border-dashed border-[var(--line)] bg-[var(--panel-soft)] md:block" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
              const isSelected = selectedDay === day
              const dayItems = itemsByDay[day] ?? []
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={`flex min-h-[138px] flex-col gap-2 rounded-[16px] border p-3 text-left transition-colors ${
                    isToday
                      ? 'border-blue-500 bg-blue-50'
                      : isSelected
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-[var(--line)] bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{day}</span>
                  {dayItems.slice(0, 3).map((item) => (
                    <EventCard key={item.id} item={item} />
                  ))}
                  {dayItems.length > 3 && (
                    <span className="pl-1 text-[0.72rem] text-[var(--muted)]">+{dayItems.length - 3} อีก</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function EventCard({ item }: { item: CalendarItem }) {
  const time = new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`rounded-[12px] border px-2.5 py-2 text-[0.72rem] leading-snug ${PLATFORM_STYLE[item.platform] ?? PLATFORM_STYLE.other}`}>
      <div className="mb-1 flex items-center gap-2">
        <PlatformIcon platform={item.platform} />
        <span className="text-[0.68rem] text-[var(--muted)]">{time}</span>
      </div>
      <strong className="block truncate text-slate-900">{item.title}</strong>
    </div>
  )
}

function DayDetailModal({
  day,
  month,
  year,
  items,
  onClose,
}: {
  day: number
  month: number
  year: number
  items: CalendarItem[]
  onClose: () => void
}) {
  const dateLabel = new Date(year, month, day).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/30 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-[440px] overflow-y-auto border-l border-[var(--line)] bg-white p-5 shadow-2xl md:rounded-[20px] md:border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">กำหนดการประจำวัน</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{dateLabel}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{items.length} โพสต์ที่กำหนดไว้</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button px-3 py-1.5 text-sm">
            ปิด
          </button>
        </div>

        {items.length === 0 ? (
          <div className="surface-muted p-4 text-sm text-[var(--muted)]">ไม่มีโพสต์ที่กำหนดไว้สำหรับวันนี้</div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="surface-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={item.platform} />
                      <span className="text-xs font-medium text-[var(--muted)]">
                        {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-slate-950">{item.title}</h4>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">
                  {item.caption_main?.trim() || 'ไม่มีคำบรรยาย'}
                </p>
                <div className="mt-4">
                  <Link href={`/content/${item.content_item_id}`} className="text-sm font-medium text-[var(--brand)]">
                    เปิดรายละเอียดโพสต์ →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanView({ items, loading }: { items: CalendarItem[]; loading: boolean }) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {ALL_STATUSES.map((status) => {
        const statusItems = items.filter((item) => item.status === status)
        return (
          <section key={status} className="surface-card min-h-[220px] p-4">
            <div className="mb-4 flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="text-xs text-[var(--muted)]">{statusItems.length}</span>
            </div>
            {loading ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">กำลังโหลด...</p>
            ) : statusItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">ไม่มีรายการ</p>
            ) : (
              <div className="flex flex-col gap-3">
                {statusItems.map((item) => (
                  <Link key={item.id} href={`/content/${item.content_item_id}`} className="surface-muted block p-3 transition-colors hover:bg-white">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <PlatformIcon platform={item.platform} />
                      <span>
                        {new Date(item.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TimelineView({
  items, loading, daysInMonth, year, month, today,
}: {
  items: CalendarItem[]
  loading: boolean
  daysInMonth: number
  year: number
  month: number
  today: Date
}) {
  const campaignMap = new Map<string | null, { name: string; items: CalendarItem[] }>()

  for (const item of items) {
    const key = item.campaign_id ?? '__none__'
    if (!campaignMap.has(key)) {
      campaignMap.set(key, {
        name: item.campaign_name ?? 'ไม่มีแคมเปญ',
        items: [],
      })
    }
    campaignMap.get(key)!.items.push(item)
  }

  const rows = Array.from(campaignMap.entries()).sort(([a], [b]) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return 0
  })

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  return (
    <section className="surface-card p-5 md:p-6">
      {loading ? (
        <p className="py-10 text-center text-[var(--muted)]">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[var(--muted)]">ไม่มีกำหนดการในเดือนนี้</p>
      ) : (
        <div className="table-shell">
          <table className="w-full border-collapse" style={{ minWidth: `${180 + daysInMonth * 44}px` }}>
            <thead>
              <tr>
                <th className="w-[180px] pb-3 pr-4 text-left text-xs font-medium text-[var(--muted)]">แคมเปญ</th>
                {days.map((d) => (
                  <th key={d} className={`w-11 pb-3 text-center text-xs font-medium ${d === todayDay ? 'text-slate-950' : 'text-[var(--muted)]'}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, row]) => {
                const itemsByDay: Record<number, CalendarItem[]> = {}
                for (const item of row.items) {
                  const d = new Date(item.scheduled_at).getDate()
                  if (!itemsByDay[d]) itemsByDay[d] = []
                  itemsByDay[d].push(item)
                }

                return (
                  <tr key={key} className="border-t border-[var(--line)]">
                    <td className="py-3 pr-4 align-top">
                      <span className={`block max-w-[170px] truncate text-sm font-medium ${key === '__none__' ? 'text-[var(--muted)]' : 'text-slate-900'}`}>
                        {row.name}
                      </span>
                    </td>
                    {days.map((d) => {
                      const dayItems = itemsByDay[d] ?? []
                      const isToday = d === todayDay
                      return (
                        <td key={d} className={`py-2 text-center align-top ${isToday ? 'bg-slate-50' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            {dayItems.map((item) => (
                              <Link key={item.id} href={`/content/${item.content_item_id}`} title={`${item.title}\n${new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}>
                                <span className="inline-flex rounded-[10px] border border-[var(--line)] bg-white p-1">
                                  <PlatformIcon platform={item.platform} />
                                </span>
                              </Link>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
