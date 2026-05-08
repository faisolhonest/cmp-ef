'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Asset, Platform, PublishingStatus, ScheduleStatus } from '@/lib/types'
import { getSchedulePublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'
import { CHANNEL_OPTIONS, useChannelFilter, type ChannelFilter } from '@/components/ChannelFilterContext'
import FilterDropdown, { type FilterDropdownOption } from '@/components/FilterDropdown'

type CalendarItem = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  status: PublishingStatus
  content_item_id: string
  campaign_id: string | null
  campaign_name: string | null
  caption_main: string | null
  thumbnailUrl: string | null
}

type PlannerAsset = Pick<Asset, 'id' | 'asset_type' | 'url' | 'thumbnail_url'>

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const STATUS_ORDER: PublishingStatus[] = ['scheduled', 'published', 'failed', 'incomplete']
const STATUS_LEGEND: { status: PublishingStatus; label: string; dot: string }[] = [
  { status: 'scheduled', label: 'กำหนดแล้ว', dot: 'bg-violet-400' },
  { status: 'published', label: 'เผยแพร่แล้ว', dot: 'bg-green-400' },
  { status: 'failed', label: 'โพสต์ไม่สำเร็จ', dot: 'bg-red-400' },
  { status: 'incomplete', label: 'ข้อมูลไม่ครบ', dot: 'bg-amber-400' },
]
const STATUS_FILTER_OPTIONS: FilterDropdownOption[] = [
  { value: 'all', label: 'ทั้งหมด', dotClassName: 'bg-slate-400' },
  { value: 'scheduled', label: 'กำหนดแล้ว', dotClassName: 'bg-violet-400' },
  { value: 'published', label: 'เผยแพร่แล้ว', dotClassName: 'bg-green-400' },
  { value: 'failed', label: 'โพสต์ไม่สำเร็จ', dotClassName: 'bg-red-400' },
  { value: 'incomplete', label: 'ข้อมูลไม่ครบ', dotClassName: 'bg-amber-400' },
]
const CHANNEL_DROPDOWN_OPTIONS = CHANNEL_OPTIONS.map(({ value, label, dotClassName }) => ({
  value,
  label,
  dotClassName,
}))
const PLANNER_THUMB_ICON_CLASS =
  '[&_.platform-badge]:!h-8 [&_.platform-badge]:!w-8 [&_.icon-svg]:!h-4 [&_.icon-svg]:!w-4'

export default function PlannerPage() {
  const today = new Date()
  const [view, setView] = useState<'calendar' | 'kanban' | 'timeline'>('calendar')
  const [currentDate, setCurrentDate] = useState(today)
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [brandFilter, setBrandFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PublishingStatus>('all')
  const { channelFilter, setChannelFilter } = useChannelFilter()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const defaultDay =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : 1

  useEffect(() => {
    setSelectedDay(defaultDay)
  }, [defaultDay])

  useEffect(() => {
    let stale = false
    setLoading(true)

    const startOfMonth = new Date(year, month, 1).toISOString()
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    // !inner ensures rows whose related content_item doesn't match the filter
    // are excluded entirely (true inner join), not returned with null content.
    let query = supabase
      .from('cmp_schedules')
      .select(`
        id, content_item_id, platform, scheduled_at, status,
        cmp_content_items!inner(id, title, content_type, caption_main, campaign_id, asset_ids,
          cmp_campaigns(id, name))
      `)
      .gte('scheduled_at', startOfMonth)
      .lte('scheduled_at', endOfMonth)
      .order('scheduled_at')

    if (channelFilter !== 'all') query = query.eq('platform', channelFilter)
    if (campaignFilter !== 'all') query = query.eq('cmp_content_items.campaign_id', campaignFilter)

    query.then(async ({ data }) => {
      if (stale) return
      const assetIds = Array.from(
        new Set(
          (data ?? []).flatMap((schedule: any) => {
            const content = Array.isArray(schedule.cmp_content_items) ? schedule.cmp_content_items[0] : schedule.cmp_content_items
            return content?.asset_ids ?? []
          })
        )
      )
      const { data: assetData } = assetIds.length
        ? await supabase.from('cmp_assets').select('id, asset_type, url, thumbnail_url').in('id', assetIds)
        : { data: [] as PlannerAsset[] }
      if (stale) return
      const assetsById = new Map((assetData ?? []).map((asset) => [asset.id, asset as PlannerAsset]))
      const mappedItems =
        (data ?? []).map((schedule: any) => {
          const content = Array.isArray(schedule.cmp_content_items) ? schedule.cmp_content_items[0] : schedule.cmp_content_items
          const campaign = content?.cmp_campaigns
            ? (Array.isArray(content.cmp_campaigns) ? content.cmp_campaigns[0] : content.cmp_campaigns)
            : null
          const status = getSchedulePublishingStatus(schedule.status as ScheduleStatus)

          return {
            id: schedule.id,
            content_item_id: schedule.content_item_id,
            platform: schedule.platform as Platform,
            scheduled_at: schedule.scheduled_at,
            title: content?.title ?? '(ไม่มีชื่อ)',
            caption_main: content?.caption_main ?? null,
            status,
            campaign_id: content?.campaign_id ?? null,
            campaign_name: campaign?.name ?? null,
            thumbnailUrl: getFirstAssetThumbnail(content?.asset_ids ?? [], assetsById),
          }
        })
      setItems(statusFilter === 'all' ? mappedItems : mappedItems.filter((item) => item.status === statusFilter))
      setLoading(false)
    })

    return () => { stale = true }
  }, [campaignFilter, channelFilter, month, statusFilter, year])

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
  const todayItemsCount = items.filter((item) => {
    const date = new Date(item.scheduled_at)
    return item.status === 'scheduled' && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  }).length
  const scheduledCount = items.filter((item) => item.status === 'scheduled').length
  const publishedCount = items.filter((item) => item.status === 'published').length
  const failedCount = items.filter((item) => item.status === 'failed').length

  return (
    <div className="planner-shell">
      <section className="planner-main">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <section className="planner-header-card shrink-0">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="planner-title-icon">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-[1.95rem] font-bold leading-none text-slate-950">ปฏิทินคอนเทนต์</h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">วางแผน จัดคิว และติดตามโพสต์ทุกช่องทางในมุมมองเดียว</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="segmented-control">
                  {(['calendar', 'kanban', 'timeline'] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setView(item)} className="segmented-option text-sm font-medium" data-active={view === item}>
                      {item === 'calendar' ? 'Calendar' : item === 'kanban' ? 'Kanban' : 'Timeline'}
                    </button>
                  ))}
                </div>
                <Link href="/content/new" className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold">
                  <span className="text-base leading-none">+</span>
                  เพิ่มกิจกรรม
                </Link>
              </div>
            </div>
            <div className="planner-summary-grid">
              <div className="planner-summary-card">
                <span>Today queue</span>
                <strong>{todayItemsCount}</strong>
              </div>
              <div className="planner-summary-card">
                <span>Scheduled</span>
                <strong>{scheduledCount}</strong>
              </div>
              <div className="planner-summary-card">
                <span>Failed</span>
                <strong>{failedCount}</strong>
              </div>
              <div className="planner-summary-card">
                <span>Published</span>
                <strong>{publishedCount}</strong>
              </div>
            </div>
          </section>

          <section className="planner-filter-card planner-workspace-card flex-1 min-h-0">
            <div className="planner-workspace-shell">
              <div className="planner-controls-row">
                  <div className="planner-filter-grid">
                    <FilterDropdown
                      icon={<FilterIcon icon="brand" />}
                      label="แบรนด์"
                      value={brandFilter}
                      onChange={setBrandFilter}
                      options={[{ value: 'all', label: 'ทั้งหมด' }]}
                    />
                    <FilterDropdown
                      icon={<FilterIcon icon="campaign" />}
                      label="แคมเปญ"
                      value={campaignFilter}
                      onChange={setCampaignFilter}
                      options={[{ value: 'all', label: 'ทั้งหมด' }, ...campaignOptions]}
                    />
                    <FilterDropdown
                      icon={<FilterIcon icon="platform" />}
                      label="ช่องทาง"
                      value={channelFilter}
                      onChange={(value) => setChannelFilter(value as ChannelFilter)}
                      options={CHANNEL_DROPDOWN_OPTIONS}
                    />
                    <FilterDropdown
                      icon={<FilterIcon icon="status" />}
                      label="สถานะเผยแพร่"
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as 'all' | PublishingStatus)}
                      options={STATUS_FILTER_OPTIONS}
                    />
                  </div>

                  <div className="planner-calendar-controls">
                    <div className="planner-toolbar-group">
                      <button
                        type="button"
                        onClick={() => {
                          setBrandFilter('all')
                          setCampaignFilter('all')
                          setChannelFilter('all')
                          setStatusFilter('all')
                          const now = new Date()
                          setCurrentDate(now)
                          setSelectedDay(now.getDate())
                        }}
                        className="planner-nav-button text-sm font-medium"
                      >
                        รีเซ็ต
                      </button>
                      <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="planner-nav-button" aria-label="Previous month">
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date()
                          setCurrentDate(now)
                          setSelectedDay(now.getDate())
                        }}
                        className="planner-nav-button text-sm font-semibold"
                      >
                        วันนี้
                      </button>
                      <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="planner-nav-button" aria-label="Next month">
                        ›
                      </button>
                    </div>
                    <FilterDropdown
                      label="เดือน"
                      value={String(month)}
                      onChange={(value) => setCurrentDate(new Date(year, Number(value), 1))}
                      options={MONTHS_TH.map((label, index) => ({
                        value: String(index),
                        label: `${label} ${year + 543}`,
                      }))}
                      className="planner-month-dropdown"
                      menuAlign="right"
                    />
                  </div>
              </div>

              <div className="planner-legend-row">
                  {STATUS_LEGEND.map((item) => (
                    <div key={item.status} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                      <span>{item.label}</span>
                    </div>
                  ))}
              </div>

              <div className="planner-workspace-grid">
                <div className="planner-calendar-column">
                <div className="planner-pane-card flex-1 min-h-0 overflow-hidden">
                  {view === 'calendar' ? (
                    <>
                      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-slate-50/80">
                        {WEEKDAYS.map((day) => (
                          <div key={day} className="px-4 py-3 text-center text-sm font-medium text-slate-500">{day}</div>
                        ))}
                      </div>

                      <div className="planner-calendar-grid">
                        {Array.from({ length: firstDay }).map((_, index) => (
                          <div key={`empty-${index}`} className="planner-empty-cell hidden xl:block" />
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
                              className={`planner-day-cell ${isSelected ? 'planner-day-cell-selected' : ''} ${isToday ? 'planner-day-cell-today' : ''}`}
                            >
                              <span className={`planner-day-number ${isToday ? 'planner-day-number-today' : ''}`}>{day}</span>
                              <div className="flex flex-col gap-2">
                                {dayItems.slice(0, 3).map((item) => (
                                  <EventCard key={item.id} item={item} />
                                ))}
                                {dayItems.length > 3 && (
                                  <span className="pl-1 text-[11px] font-medium text-[var(--muted)]">+{dayItems.length - 3} รายการ</span>
                                )}
                              </div>
                            </button>
                          )
                        })}

                        {Array.from({ length: trailingDays }).map((_, index) => (
                          <div key={`tail-${index}`} className="planner-empty-cell hidden xl:block" />
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

              <aside className="planner-sidebar">
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <section className="planner-sidebar-section shrink-0 border-b border-[var(--line)] pb-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="planner-section-title">โพสต์ถัดไป</h3>
                      <Link href="/content" className="planner-section-link">ดูทั้งหมด</Link>
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

                  <section className="planner-sidebar-section flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
                    <div className="mb-4 shrink-0">
                      <h3 className="planner-section-title">รายละเอียดวันที่เลือก {selectedLabel}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">เลือกรายการในปฏิทินเพื่อดูรายละเอียดโพสต์ของวันนั้น</p>
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
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function getFirstAssetThumbnail(assetIds: string[], assetsById: Map<string, PlannerAsset>) {
  for (const assetId of assetIds) {
    const asset = assetsById.get(assetId)
    if (!asset) continue
    if (asset.asset_type === 'image') return asset.thumbnail_url || asset.url
    if ((asset.asset_type === 'video' || asset.asset_type === 'reel' || asset.asset_type === 'story') && asset.thumbnail_url) {
      return asset.thumbnail_url
    }
  }
  return null
}

function EventCard({ item }: { item: CalendarItem }) {
  return (
    <div className={`planner-event ${statusEventClass[item.status]}`}>
      <div className="flex items-center gap-2">
        <PlatformIcon platform={item.platform} />
        <span className="text-[10px] font-semibold text-slate-500">
          {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] font-semibold text-slate-800">{item.title}</p>
    </div>
  )
}

function PostPreviewCard({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  return (
    <div className={`planner-list-card ${compact ? 'planner-compact-post-card' : 'p-3'}`}>
      <div className="flex items-start gap-3">
        {item.thumbnailUrl ? (
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[14px] border border-[var(--line)] bg-slate-50">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${item.thumbnailUrl}")` }}
              aria-hidden="true"
            />
            <span className="absolute -bottom-1 -right-1 origin-bottom-right scale-[0.68] rounded-full border-2 border-white bg-white shadow-sm">
              <PlatformIcon platform={item.platform} />
            </span>
          </div>
        ) : (
          <div className={`planner-thumb ${compact ? 'planner-mini-thumb' : ''} planner-thumb-soft ${PLANNER_THUMB_ICON_CLASS}`}>
            <PlatformIcon platform={item.platform} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-[13px] font-semibold text-slate-900">{item.title}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            {' • '}
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
    <div className="planner-list-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[14px] border border-[var(--line)] bg-slate-50 ${PLANNER_THUMB_ICON_CLASS}`}>
            <PlatformIcon platform={item.platform} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="text-xs font-medium text-[var(--muted)]">
                {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
        {item.thumbnailUrl && (
          <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-[16px] border border-emerald-100 bg-emerald-50">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${item.thumbnailUrl}")` }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <dl className="planner-meta-grid mt-4">
        <dt className="planner-meta-label">แคมเปญ</dt>
        <dd className="planner-meta-value truncate">{item.campaign_name ?? 'ไม่ระบุ'}</dd>
        <dt className="planner-meta-label">ช่องทาง</dt>
        <dd className="planner-meta-value uppercase">{item.platform}</dd>
        <dt className="planner-meta-label">สถานะ</dt>
        <dd className="planner-meta-value">{statusText[item.status]}</dd>
        <dt className="planner-meta-label">ผู้รับผิดชอบ</dt>
        <dd className="planner-meta-value">ไม่ระบุ</dd>
      </dl>

      <Link href={`/content/${item.content_item_id}`} className="primary-button mt-4 inline-flex w-full justify-center px-3 py-2.5 text-xs font-semibold">
        ดูรายละเอียดโพสต์
      </Link>
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
    <div className="grid h-full gap-4 overflow-auto bg-slate-50/60 p-4 xl:grid-cols-5">
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
    <div className="table-shell h-full bg-slate-50/60 p-4">
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

const statusEventClass: Record<PublishingStatus, string> = {
  draft: 'planner-event-draft',
  scheduled: 'planner-event-scheduled',
  published: 'planner-event-published',
  failed: 'planner-event-failed',
  incomplete: 'planner-event-incomplete',
}

const statusText: Record<PublishingStatus, string> = {
  draft: 'ร่าง',
  scheduled: 'กำหนดแล้ว',
  published: 'เผยแพร่แล้ว',
  failed: 'โพสต์ไม่สำเร็จ',
  incomplete: 'ข้อมูลไม่ครบ',
}
