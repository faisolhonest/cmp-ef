'use client'
import { useEffect, useMemo, useState } from 'react'
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
const STATUS_ORDER: ContentStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published']
const STATUS_LEGEND: { status: ContentStatus; label: string; dot: string }[] = [
  { status: 'draft', label: 'Draft', dot: 'bg-slate-400' },
  { status: 'review', label: 'Review', dot: 'bg-yellow-400' },
  { status: 'approved', label: 'Approved', dot: 'bg-blue-400' },
  { status: 'scheduled', label: 'Scheduled', dot: 'bg-violet-400' },
  { status: 'published', label: 'Published', dot: 'bg-green-400' },
]

export default function PlannerPage() {
  const today = new Date()
  const [view, setView] = useState<'calendar' | 'kanban' | 'timeline'>('calendar')
  const [currentDate, setCurrentDate] = useState(today)
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [brandFilter, setBrandFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const defaultDay =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : 1

  useEffect(() => {
    setSelectedDay(defaultDay)
  }, [defaultDay])

  useEffect(() => {
    setLoading(true)

    const startOfMonth = new Date(year, month, 1).toISOString()
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    let query = supabase
      .from('cmp_schedules')
      .select(`
        id, content_item_id, platform, scheduled_at,
        cmp_content_items(id, title, caption_main, status, campaign_id,
          cmp_campaigns(id, name))
      `)
      .gte('scheduled_at', startOfMonth)
      .lte('scheduled_at', endOfMonth)
      .order('scheduled_at')

    if (campaignFilter !== 'all') query = query.eq('cmp_content_items.campaign_id', campaignFilter)
    if (platformFilter !== 'all') query = query.eq('platform', platformFilter)
    if (statusFilter !== 'all') query = query.eq('cmp_content_items.status', statusFilter)

    query.then(({ data }) => {
      setItems(
        (data ?? []).map((schedule: any) => {
          const content = Array.isArray(schedule.cmp_content_items) ? schedule.cmp_content_items[0] : schedule.cmp_content_items
          const campaign = content?.cmp_campaigns
            ? (Array.isArray(content.cmp_campaigns) ? content.cmp_campaigns[0] : content.cmp_campaigns)
            : null

          return {
            id: schedule.id,
            content_item_id: schedule.content_item_id,
            platform: schedule.platform as Platform,
            scheduled_at: schedule.scheduled_at,
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
  }, [campaignFilter, month, platformFilter, statusFilter, year])

  const itemsByDay = useMemo(() => {
    const grouped: Record<number, CalendarItem[]> = {}
    for (const item of items) {
      const day = new Date(item.scheduled_at).getDate()
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(item)
    }
    return grouped
  }, [items])

  const selectedDayItems = selectedDay !== null ? (itemsByDay[selectedDay] ?? []) : []

  const upcomingItems = useMemo(() => {
    const now = new Date()
    return items
      .filter((item) => item.status === 'scheduled' && new Date(item.scheduled_at) >= now)
      .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
      .slice(0, 5)
  }, [items])

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      if (item.campaign_id && item.campaign_name) map.set(item.campaign_id, item.campaign_name)
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [items])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const trailingDays = totalCells - firstDay - daysInMonth
  const selectedLabel = new Date(year, month, selectedDay ?? defaultDay).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="planner-shell">
      <section className="planner-main">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <section className="planner-header-card shrink-0">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-50 text-[var(--brand)]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-[1.75rem] font-semibold leading-tight text-slate-950">ปฏิทินคอนเทนต์</h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">วางแผน จัดคิว และติดตามโพสต์ทุกช่องทางในมุมมองเดียว</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="segmented-control">
                  {(['calendar', 'kanban', 'timeline'] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setView(item)} className="segmented-option text-sm" data-active={view === item}>
                      {item === 'calendar' ? 'Calendar' : item === 'kanban' ? 'Kanban' : 'Timeline'}
                    </button>
                  ))}
                </div>
                <Link href="/content/new" className="primary-button px-4 py-2.5 text-center text-sm font-semibold">
                  + เพิ่มกิจกรรม
                </Link>
              </div>
            </div>
          </section>

          <section className="planner-filter-card flex-1 min-h-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FilterSelect
                    icon={<FilterIcon icon="brand" />}
                    label="แบรนด์"
                    value={brandFilter}
                    onChange={setBrandFilter}
                    options={[{ value: 'all', label: 'ทั้งหมด' }]}
                  />
                  <FilterSelect
                    icon={<FilterIcon icon="campaign" />}
                    label="แคมเปญ"
                    value={campaignFilter}
                    onChange={setCampaignFilter}
                    options={[{ value: 'all', label: 'ทั้งหมด' }, ...campaignOptions]}
                  />
                  <FilterSelect
                    icon={<FilterIcon icon="platform" />}
                    label="ช่องทาง"
                    value={platformFilter}
                    onChange={(value) => setPlatformFilter(value as 'all' | Platform)}
                    options={[
                      { value: 'all', label: 'ทั้งหมด' },
                      { value: 'fb', label: 'Facebook' },
                      { value: 'ig', label: 'Instagram' },
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'youtube', label: 'YouTube' },
                      { value: 'shopee', label: 'Shopee' },
                      { value: 'other', label: 'อื่นๆ' },
                    ]}
                  />
                  <FilterSelect
                    icon={<FilterIcon icon="status" />}
                    label="สถานะ"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as 'all' | ContentStatus)}
                    options={[
                      { value: 'all', label: 'ทั้งหมด' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'review', label: 'Review' },
                      { value: 'approved', label: 'Approved' },
                      { value: 'scheduled', label: 'Scheduled' },
                      { value: 'published', label: 'Published' },
                    ]}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setBrandFilter('all')
                      setCampaignFilter('all')
                      setPlatformFilter('all')
                      setStatusFilter('all')
                      setCurrentDate(new Date())
                      setSelectedDay(new Date().getDate())
                    }}
                    className="secondary-button px-3 py-2 text-sm"
                  >
                    รีเซ็ต
                  </button>
                  <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="secondary-button flex h-10 w-10 items-center justify-center text-sm">
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      setCurrentDate(now)
                      setSelectedDay(now.getDate())
                    }}
                    className="secondary-button px-3 py-2 text-sm"
                  >
                    วันนี้
                  </button>
                  <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="secondary-button flex h-10 w-10 items-center justify-center text-sm">
                    ›
                  </button>
                  <label className="input-shell relative flex min-w-[138px] items-center gap-2 px-3 py-2 text-sm text-slate-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                    <select
                      value={month}
                      onChange={(event) => setCurrentDate(new Date(year, Number(event.target.value), 1))}
                      className="w-full appearance-none bg-transparent pr-4 text-sm font-medium text-slate-700 outline-none"
                    >
                      {MONTHS_TH.map((label, index) => (
                        <option key={label} value={index}>{label} {year + 543}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex shrink-0 flex-wrap items-center gap-5 border-b border-[var(--line)] pb-4">
                {STATUS_LEGEND.map((item) => (
                  <div key={item.status} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex-1 min-h-0 overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
                {view === 'calendar' ? (
                  <>
                    <div className="grid grid-cols-7 border-b border-[var(--line)] bg-slate-50">
                      {WEEKDAYS.map((day) => (
                        <div key={day} className="px-4 py-3 text-center text-sm font-medium text-[var(--muted)]">{day}</div>
                      ))}
                    </div>

                    <div className="planner-calendar-grid">
                      {Array.from({ length: firstDay }).map((_, index) => (
                        <div key={`empty-${index}`} className="hidden border-b border-r border-[var(--line)] bg-slate-50/70 xl:block" />
                      ))}

                      {Array.from({ length: daysInMonth }).map((_, index) => {
                        const day = index + 1
                        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                        const isSelected = selectedDay === day
                        const dayItems = itemsByDay[day] ?? []

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className={`flex min-h-[130px] flex-col gap-3 border-b border-r border-[var(--line)] p-3 text-left transition-colors ${
                              isToday
                                ? 'bg-blue-50 ring-1 ring-inset ring-blue-500'
                                : isSelected
                                ? 'bg-slate-50'
                                : 'bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{day}</span>
                            <div className="flex flex-col gap-2">
                              {dayItems.slice(0, 3).map((item) => (
                                <EventCard key={item.id} item={item} />
                              ))}
                              {dayItems.length > 3 && (
                                <span className="text-[11px] font-medium text-[var(--muted)]">+{dayItems.length - 3} รายการ</span>
                              )}
                            </div>
                          </button>
                        )
                      })}

                      {Array.from({ length: trailingDays }).map((_, index) => (
                        <div key={`tail-${index}`} className="hidden border-b border-r border-[var(--line)] bg-slate-50/70 xl:block" />
                      ))}
                    </div>
                  </>
                ) : view === 'kanban' ? (
                  <KanbanView items={items} loading={loading} />
                ) : (
                  <TimelineView items={items} loading={loading} daysInMonth={daysInMonth} year={year} month={month} today={today} />
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <aside className="planner-sidebar">
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <section className="surface-card shrink-0 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">โพสต์ถัดไป</h3>
              <Link href="/content" className="text-sm font-medium text-[var(--brand)]">ดูทั้งหมด</Link>
            </div>
            {upcomingItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีโพสต์ที่กำลังจะมาถึง</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingItems.map((item) => (
                  <PostPreviewCard key={item.id} item={item} compact />
                ))}
              </div>
            )}
          </section>

          <section className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <div className="mb-4 shrink-0">
              <h3 className="text-base font-semibold text-slate-950">รายละเอียดวันที่เลือก {selectedLabel}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">เลือกวันบนปฏิทินเพื่ออัปเดตรายการฝั่งขวา</p>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="surface-muted p-4 text-sm text-[var(--muted)]">ไม่มีโพสต์สำหรับวันที่เลือก</div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-3 pr-1">
                  {selectedDayItems.map((item) => (
                    <DayDetailCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="input-shell relative flex items-center gap-3 px-3.5 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-50 text-slate-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full appearance-none bg-transparent pr-5 text-sm font-medium text-slate-800 outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="m7 10 5 5 5-5" />
      </svg>
    </label>
  )
}

function EventCard({ item }: { item: CalendarItem }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-white px-2.5 py-2">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={item.platform} />
        <span className="text-[10px] font-medium text-[var(--muted)]">
          {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] font-semibold text-slate-900">{item.title}</p>
    </div>
  )
}

function PostPreviewCard({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  return (
    <div className="surface-muted p-3 transition-colors hover:bg-white">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[12px] bg-white">
          <PlatformIcon platform={item.platform} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {new Date(item.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {!compact && item.caption_main && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{item.caption_main.trim()}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DayDetailCard({ item }: { item: CalendarItem }) {
  return (
    <div className="surface-muted p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[12px] bg-white">
          <PlatformIcon platform={item.platform} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>

          <dl className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
            <dt className="text-[var(--muted)]">แคมเปญ</dt>
            <dd className="truncate text-slate-700">{item.campaign_name ?? 'ไม่ระบุ'}</dd>
            <dt className="text-[var(--muted)]">ช่องทาง</dt>
            <dd className="uppercase text-slate-700">{item.platform}</dd>
            <dt className="text-[var(--muted)]">สถานะ</dt>
            <dd className="text-slate-700">{item.status}</dd>
            <dt className="text-[var(--muted)]">ผู้รับผิดชอบ</dt>
            <dd className="text-slate-700">ไม่ระบุ</dd>
          </dl>

          <Link href={`/content/${item.content_item_id}`} className="primary-button mt-4 inline-flex px-3 py-2 text-xs font-semibold">
            ดูรายละเอียดโพสต์
          </Link>
        </div>
      </div>
    </div>
  )
}

function FilterIcon({ icon }: { icon: 'brand' | 'campaign' | 'platform' | 'status' }) {
  switch (icon) {
    case 'brand':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 18h16M7 18V8l5-3 5 3v10M9 11h6" />
        </svg>
      )
    case 'campaign':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 19V5l12 4-12 4M17 9h2a2 2 0 0 1 2 2v3" />
        </svg>
      )
    case 'platform':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 4h12l-1 7H7L6 4Zm1 9h10l1 7H6l1-7Z" />
        </svg>
      )
  }
}

function KanbanView({ items, loading }: { items: CalendarItem[]; loading: boolean }) {
  return (
    <div className="grid h-full gap-4 overflow-auto xl:grid-cols-5">
      {STATUS_ORDER.map((status) => {
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
                      <span>{new Date(item.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
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
  items,
  loading,
  daysInMonth,
  year,
  month,
  today,
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

  const rows = Array.from(campaignMap.entries())
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  return (
    <div className="table-shell h-full">
      <section className="surface-card h-full p-5 md:p-6">
        {loading ? (
          <p className="py-10 text-center text-[var(--muted)]">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[var(--muted)]">ไม่มีกำหนดการในเดือนนี้</p>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: `${180 + daysInMonth * 44}px` }}>
            <thead>
              <tr>
                <th className="w-[180px] pb-3 pr-4 text-left text-xs font-medium text-[var(--muted)]">แคมเปญ</th>
                {days.map((day) => (
                  <th key={day} className={`w-11 pb-3 text-center text-xs font-medium ${day === todayDay ? 'text-slate-950' : 'text-[var(--muted)]'}`}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, row]) => {
                const rowItemsByDay: Record<number, CalendarItem[]> = {}
                for (const item of row.items) {
                  const day = new Date(item.scheduled_at).getDate()
                  if (!rowItemsByDay[day]) rowItemsByDay[day] = []
                  rowItemsByDay[day].push(item)
                }

                return (
                  <tr key={key} className="border-t border-[var(--line)]">
                    <td className="py-3 pr-4 align-top">
                      <span className={`block max-w-[170px] truncate text-sm font-medium ${key === '__none__' ? 'text-[var(--muted)]' : 'text-slate-900'}`}>
                        {row.name}
                      </span>
                    </td>
                    {days.map((day) => (
                      <td key={day} className={`py-2 text-center align-top ${day === todayDay ? 'bg-slate-50' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          {(rowItemsByDay[day] ?? []).map((item) => (
                            <Link key={item.id} href={`/content/${item.content_item_id}`}>
                              <span className="inline-flex rounded-[10px] border border-[var(--line)] bg-white p-1">
                                <PlatformIcon platform={item.platform} />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
