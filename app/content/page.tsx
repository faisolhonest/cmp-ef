'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItem, ScheduleStatus, Platform, ContentType, Campaign } from '@/lib/types'
import { getPublishingStatus, type DisplayPublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'
import { CHANNEL_OPTIONS, useChannelFilter, type ChannelFilter } from '@/components/ChannelFilterContext'
import FilterDropdown from '@/components/FilterDropdown'

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'โพสต์',
  reel: 'Reel',
  story: 'Story',
  video: 'วิดีโอ',
  live_teaser: 'Live Teaser',
}

const PUBLISHING_STATUSES: DisplayPublishingStatus[] = ['draft', 'scheduled', 'published', 'failed', 'incomplete', 'archived']
const ALL_CONTENT_TYPES: ContentType[] = ['post', 'reel', 'story', 'video', 'live_teaser']
const statusDotClass: Record<DisplayPublishingStatus, string> = {
  draft: 'bg-slate-400',
  scheduled: 'bg-violet-400',
  published: 'bg-green-400',
  failed: 'bg-red-400',
  incomplete: 'bg-amber-400',
  archived: 'bg-slate-500',
}
const statusFilterLabels: Record<DisplayPublishingStatus, string> = {
  draft: 'ยังไม่กำหนด',
  scheduled: 'กำหนดแล้ว',
  published: 'เผยแพร่แล้ว',
  failed: 'โพสต์ไม่สำเร็จ',
  incomplete: 'ข้อมูลไม่ครบ',
  archived: 'เก็บถาวร',
}

type ContentWithSchedulePlatforms = ContentItem & {
  platforms: Platform[]
  publishingStatus: DisplayPublishingStatus
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentWithSchedulePlatforms[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<DisplayPublishingStatus | ''>('')
  const [filterCampaign, setFilterCampaign] = useState<string>('')
  const [filterType, setFilterType] = useState<ContentType | ''>('')
  const { channelFilter, setChannelFilter } = useChannelFilter()

  useEffect(() => {
    async function load() {
      const [{ data: contentData }, { data: schedulesData }, { data: campaignData }] = await Promise.all([
        supabase.from('cmp_content_items').select('*').order('created_at', { ascending: false }),
        supabase.from('cmp_schedules').select('content_item_id, platform, status'),
        supabase.from('cmp_campaigns').select('*').eq('status', 'active').order('name'),
      ])

      const platformsByItem: Record<string, Platform[]> = {}
      const schedulesByItem: Record<string, { status: ScheduleStatus }[]> = {}
      for (const s of schedulesData ?? []) {
        if (!platformsByItem[s.content_item_id]) platformsByItem[s.content_item_id] = []
        if (!platformsByItem[s.content_item_id].includes(s.platform as Platform)) {
          platformsByItem[s.content_item_id].push(s.platform as Platform)
        }
        if (!schedulesByItem[s.content_item_id]) schedulesByItem[s.content_item_id] = []
        schedulesByItem[s.content_item_id].push({ status: s.status as ScheduleStatus })
      }

      setItems(
        (contentData ?? []).map((item) => ({
          ...item,
          platforms: platformsByItem[item.id] ?? [],
          publishingStatus: getPublishingStatus(schedulesByItem[item.id] ?? [], item.status),
        }))
      )
      setCampaigns(campaignData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter((item) => {
    if (filterStatus && item.publishingStatus !== filterStatus) return false
    if (channelFilter !== 'all' && !item.platforms.includes(channelFilter)) return false
    if (filterCampaign && item.campaign_id !== filterCampaign) return false
    if (filterType && item.content_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!item.title.toLowerCase().includes(q) && !(item.caption_main ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <>
      <section className="page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">คลังคอนเทนต์</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">รวมทุก content ที่วางแผนและเผยแพร่แล้ว</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="input-shell flex min-w-[240px] items-center gap-2 px-3.5 py-2.5">
              <SearchIcon />
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือ caption..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border-0 bg-transparent text-sm outline-none"
              />
            </div>
            <Link href="/content/new" className="primary-button px-4 py-2.5 text-center text-sm font-semibold">
              + สร้างคอนเทนต์
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-card toolbar-card">
        <FilterDropdown
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as DisplayPublishingStatus | '')}
          label="สถานะเผยแพร่"
          options={[
            { value: '', label: 'ทุกสถานะ', dotClassName: 'bg-slate-400' },
            ...PUBLISHING_STATUSES.map((s) => ({ value: s, label: statusFilterLabels[s], dotClassName: statusDotClass[s] })),
          ]}
        />
        <FilterDropdown
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as ChannelFilter)}
          label="ช่องทาง"
          options={CHANNEL_OPTIONS.map(({ value, label, dotClassName }) => ({ value, label, dotClassName }))}
        />
        <FilterDropdown
          value={filterCampaign}
          onChange={(v) => setFilterCampaign(v)}
          label="แคมเปญ"
          options={[
            { value: '', label: 'ทุกแคมเปญ' },
            ...campaigns.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterDropdown
          value={filterType}
          onChange={(v) => setFilterType(v as ContentType | '')}
          label="ประเภท"
          options={[
            { value: '', label: 'ทุกประเภท' },
            ...ALL_CONTENT_TYPES.map((t) => ({ value: t, label: CONTENT_TYPE_LABELS[t] })),
          ]}
        />
        {(filterStatus || channelFilter !== 'all' || filterCampaign || filterType || search) && (
          <button
            onClick={() => {
              setFilterStatus('')
              setChannelFilter('all')
              setFilterCampaign('')
              setFilterType('')
              setSearch('')
            }}
            className="subtle-button px-3.5 py-2 text-sm"
          >
            ล้างตัวกรอง
          </button>
        )}
      </section>

      <section className="surface-card p-5 md:p-6">
        {loading ? (
          <div className="py-16 text-center text-[var(--muted)]">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[var(--muted)]">
            ไม่พบคอนเทนต์ที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <div className="table-shell">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">ชื่อ</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">ประเภท</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">แพลตฟอร์ม</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">สถานะ</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">วันที่สร้าง</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id} className={`group border-b border-[var(--line)] last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-blue-50/80`}>
                    <td className="py-4 pr-4">
                      <Link href={`/content/${item.id}`} className="font-medium text-slate-900 transition-colors hover:text-[var(--brand)]">
                        {item.title}
                      </Link>
                      {item.caption_main && (
                        <p className="mt-1 max-w-[320px] truncate text-xs text-[var(--muted)]">
                          {item.caption_main}
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-[var(--muted)]">
                      {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex gap-2">
                        {item.platforms.length > 0
                          ? item.platforms.map((p) => <PlatformIcon key={p} platform={p} />)
                          : <span className="text-[var(--muted)]">—</span>}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={item.publishingStatus} />
                    </td>
                    <td className="py-4 text-[var(--muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {new Date(item.created_at).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <Link href={`/content/${item.id}`} className="rounded-[10px] border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700">
                            View
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--muted)]">
          {filtered.length} รายการ{filtered.length !== items.length && ` (จากทั้งหมด ${items.length})`}
        </p>
      </section>
    </>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}
