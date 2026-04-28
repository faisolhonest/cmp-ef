'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Platform, ContentStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

type CalendarItem = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  status: ContentStatus
  content_item_id: string
  campaign_id: string | null
  campaign_name: string | null
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// Platform event card styles (colors matching dashboard-preview.html)
const PLATFORM_STYLE: Record<Platform, { bg: string; icon: string; iconBg: string }> = {
  fb:         { bg: 'rgba(53,108,255,0.10)',  icon: 'f',  iconBg: '#1877f2' },
  ig:         { bg: 'rgba(143,107,255,0.14)', icon: 'ig', iconBg: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)' },
  tiktok:     { bg: 'rgba(20,20,20,0.07)',    icon: '♪',  iconBg: '#010101' },
  youtube:    { bg: 'rgba(255,60,60,0.10)',   icon: '▶',  iconBg: '#ff0000' },
  shopee:     { bg: 'rgba(238,95,17,0.10)',   icon: 'S',  iconBg: '#ee5f11' },
  other:      { bg: 'rgba(100,100,100,0.08)', icon: '•',  iconBg: '#888' },
}

const ALL_STATUSES: ContentStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published']

export default function PlannerPage() {
  const [view, setView] = useState<'calendar' | 'kanban' | 'timeline'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    setLoading(true)
    const startOfMonth = new Date(year, month, 1).toISOString()
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    supabase
      .from('cmp_schedules')
      .select(`
        id, content_item_id, platform, scheduled_at,
        cmp_content_items(id, title, status, campaign_id,
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
              status: (content?.status ?? 'draft') as ContentStatus,
              campaign_id: content?.campaign_id ?? null,
              campaign_name: campaign?.name ?? null,
            }
          })
        )
        setLoading(false)
      })
  }, [year, month])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const itemsByDay: Record<number, CalendarItem[]> = {}
  for (const item of items) {
    const d = new Date(item.scheduled_at).getDate()
    if (!itemsByDay[d]) itemsByDay[d] = []
    itemsByDay[d].push(item)
  }

  return (
    <>
      {/* Topbar */}
      <section
        className="flex justify-between items-center gap-4 flex-wrap"
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '26px',
          padding: '18px 22px',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div>
          <h2 className="text-[1.5rem] font-bold leading-tight">ปฏิทินคอนเทนต์</h2>
          <p className="text-[var(--muted)] text-sm mt-1">วางแผนและติดตามสถานะโพสต์ทุกช่องทาง</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month nav */}
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="w-9 h-9 rounded-[10px] border border-[var(--line)] bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            ‹
          </button>
          <span className="text-sm font-semibold min-w-[120px] text-center">
            {MONTHS_TH[month]} {year + 543}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="w-9 h-9 rounded-[10px] border border-[var(--line)] bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            ›
          </button>
          {/* View switcher */}
          <div className="flex bg-[#edf2fb] rounded-[14px] p-1 gap-1 ml-2">
            {(['calendar', 'kanban', 'timeline'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 rounded-[10px] text-sm transition-all ${view === v ? 'bg-white text-[var(--brand)] shadow-sm font-semibold' : 'text-[var(--muted)]'}`}
              >
                {v === 'calendar' ? 'Calendar' : v === 'kanban' ? 'Kanban' : 'Timeline'}
              </button>
            ))}
          </div>
          <Link
            href="/content/new"
            className="px-4 py-2.5 rounded-[14px] text-sm font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #336bff, #4b91ff)', boxShadow: '0 14px 24px rgba(51,107,255,0.24)' }}
          >
            + เพิ่มกิจกรรม
          </Link>
        </div>
      </section>

      {view === 'calendar' && (
        <CalendarView
          items={items}
          loading={loading}
          itemsByDay={itemsByDay}
          firstDay={firstDay}
          daysInMonth={daysInMonth}
          year={year}
          month={month}
          today={today}
        />
      )}

      {view === 'kanban' && <KanbanView items={items} loading={loading} />}

      {view === 'timeline' && (
        <TimelineView items={items} loading={loading} daysInMonth={daysInMonth} year={year} month={month} today={today} />
      )}
    </>
  )
}

// --- Calendar View ---

function CalendarView({
  items, loading, itemsByDay, firstDay, daysInMonth, year, month, today,
}: {
  items: CalendarItem[]
  loading: boolean
  itemsByDay: Record<number, CalendarItem[]>
  firstDay: number
  daysInMonth: number
  year: number
  month: number
  today: Date
}) {
  return (
    <section
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(255,255,255,0.78)',
        borderRadius: '28px',
        padding: '20px',
        boxShadow: '0 18px 38px rgba(18,32,58,0.08)',
      }}
    >
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-sm text-[var(--muted)] py-2">{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[110px] opacity-25 rounded-[14px] border border-dashed border-[var(--line)]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const dayItems = itemsByDay[day] ?? []
          return (
            <div
              key={day}
              className="min-h-[110px] p-2 rounded-[14px] flex flex-col gap-1.5"
              style={{
                border: isToday ? '1px solid rgba(47,102,255,0.34)' : '1px solid var(--line)',
                background: isToday
                  ? 'linear-gradient(180deg, rgba(47,102,255,0.08), rgba(255,255,255,0.92))'
                  : 'rgba(255,255,255,0.72)',
              }}
            >
              <span className={`text-sm font-bold ${isToday ? 'text-[var(--brand)]' : ''}`}>{day}</span>
              {dayItems.slice(0, 3).map((item) => (
                <EventCard key={item.id} item={item} />
              ))}
              {dayItems.length > 3 && (
                <span className="text-[0.68rem] text-[var(--muted)] pl-1">+{dayItems.length - 3} อีก</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function EventCard({ item }: { item: CalendarItem }) {
  const style = PLATFORM_STYLE[item.platform] ?? PLATFORM_STYLE.other
  const time = new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      href={`/content/${item.content_item_id}`}
      className="rounded-[10px] p-1.5 text-[0.7rem] leading-snug flex items-start gap-1.5 hover:opacity-80 transition-opacity"
      style={{ background: style.bg }}
    >
      {/* Platform icon */}
      <span
        className="flex-shrink-0 w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-white font-bold text-[0.6rem] mt-[1px]"
        style={{ background: style.iconBg }}
      >
        {style.icon}
      </span>
      <span className="min-w-0">
        <strong className="block truncate">{item.title}</strong>
        <span className="text-[var(--muted)]">{time}</span>
      </span>
    </Link>
  )
}

// --- Kanban View ---

function KanbanView({ items, loading }: { items: CalendarItem[]; loading: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ALL_STATUSES.map((status) => {
        const statusItems = items.filter((item) => item.status === status)
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div
              className="rounded-[22px] p-4 flex flex-col gap-3"
              style={{
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.78)',
                boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
                minHeight: '200px',
              }}
            >
              <div className="flex justify-between items-center">
                <StatusBadge status={status} />
                <span className="text-xs text-[var(--muted)]">{statusItems.length}</span>
              </div>
              {statusItems.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">ไม่มีรายการ</p>
              ) : (
                statusItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/content/${item.content_item_id}`}
                    className="block p-3 rounded-[14px] border border-[var(--line)] bg-white hover:shadow-sm transition-shadow"
                  >
                    <p className="text-sm font-medium mb-1.5 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span
                        className="w-[16px] h-[16px] rounded-[4px] flex items-center justify-center text-white font-bold text-[0.55rem] flex-shrink-0"
                        style={{ background: PLATFORM_STYLE[item.platform]?.iconBg ?? '#888' }}
                      >
                        {PLATFORM_STYLE[item.platform]?.icon}
                      </span>
                      <span>
                        {new Date(item.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Timeline View ---

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
  // Group by campaign
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

  // Sort: campaigns first, then no-campaign last
  const rows = Array.from(campaignMap.entries()).sort(([a], [b]) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return 0
  })

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  return (
    <section
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(255,255,255,0.78)',
        borderRadius: '28px',
        padding: '20px',
        boxShadow: '0 18px 38px rgba(18,32,58,0.08)',
        overflowX: 'auto',
      }}
    >
      {loading ? (
        <p className="text-center py-10 text-[var(--muted)]">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="text-center py-10 text-[var(--muted)]">ไม่มีกำหนดการในเดือนนี้</p>
      ) : (
        <table className="w-full border-collapse" style={{ minWidth: `${180 + daysInMonth * 36}px` }}>
          <thead>
            <tr>
              <th className="text-left text-xs text-[var(--muted)] font-medium pb-3 pr-4 w-[180px]">แคมเปญ</th>
              {days.map((d) => (
                <th
                  key={d}
                  className="text-center text-xs font-medium pb-3 w-9"
                  style={{
                    color: d === todayDay ? 'var(--brand)' : 'var(--muted)',
                    fontWeight: d === todayDay ? 700 : 400,
                  }}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, row]) => {
              // Index items by day
              const itemsByDay: Record<number, CalendarItem[]> = {}
              for (const item of row.items) {
                const d = new Date(item.scheduled_at).getDate()
                if (!itemsByDay[d]) itemsByDay[d] = []
                itemsByDay[d].push(item)
              }

              return (
                <tr key={key} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-4">
                    <span
                      className="text-sm font-medium truncate block max-w-[170px]"
                      style={{ color: key === '__none__' ? 'var(--muted)' : 'var(--text)' }}
                    >
                      {row.name}
                    </span>
                  </td>
                  {days.map((d) => {
                    const dayItems = itemsByDay[d] ?? []
                    const isToday = d === todayDay
                    return (
                      <td
                        key={d}
                        className="py-2 text-center align-middle"
                        style={{
                          background: isToday ? 'rgba(47,102,255,0.04)' : undefined,
                        }}
                      >
                        {dayItems.length > 0 && (
                          <div className="flex flex-col gap-0.5 items-center">
                            {dayItems.map((item) => (
                              <Link
                                key={item.id}
                                href={`/content/${item.content_item_id}`}
                                title={`${item.title}\n${new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
                                className="block hover:opacity-70 transition-opacity"
                              >
                                <span
                                  className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-white font-bold text-[0.55rem] mx-auto"
                                  style={{ background: PLATFORM_STYLE[item.platform]?.iconBg ?? '#888' }}
                                >
                                  {PLATFORM_STYLE[item.platform]?.icon}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-4 border-t border-[var(--line)] flex-wrap">
        {(Object.entries(PLATFORM_STYLE) as [Platform, typeof PLATFORM_STYLE[Platform]][])
          .filter(([p]) => ['fb', 'ig', 'tiktok', 'youtube'].includes(p))
          .map(([platform, s]) => (
            <div key={platform} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span
                className="w-[16px] h-[16px] rounded-[4px] flex items-center justify-center text-white font-bold text-[0.5rem]"
                style={{ background: s.iconBg }}
              >
                {s.icon}
              </span>
              <span>
                {({ fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' } as Record<string, string>)[platform]}
              </span>
            </div>
          ))}
        <span className="text-xs text-[var(--muted)] ml-auto">hover เพื่อดูชื่อโพสต์</span>
      </div>
    </section>
  )
}
