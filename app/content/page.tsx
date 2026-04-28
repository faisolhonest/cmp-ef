'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItem, ContentStatus, Platform, ContentType, Campaign } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'โพสต์',
  reel: 'Reel',
  story: 'Story',
  video: 'วิดีโอ',
  live_teaser: 'Live Teaser',
}

const ALL_STATUSES: ContentStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived']
const ALL_PLATFORMS: Platform[] = ['fb', 'ig', 'tiktok', 'youtube', 'shopee', 'other']
const ALL_CONTENT_TYPES: ContentType[] = ['post', 'reel', 'story', 'video', 'live_teaser']

type ContentWithSchedulePlatforms = ContentItem & { platforms: Platform[] }

export default function ContentPage() {
  const [items, setItems] = useState<ContentWithSchedulePlatforms[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('')
  const [filterPlatform, setFilterPlatform] = useState<Platform | ''>('')
  const [filterCampaign, setFilterCampaign] = useState<string>('')
  const [filterType, setFilterType] = useState<ContentType | ''>('')

  useEffect(() => {
    async function load() {
      const [{ data: contentData }, { data: schedulesData }, { data: campaignData }] = await Promise.all([
        supabase.from('cmp_content_items').select('*').order('created_at', { ascending: false }),
        supabase.from('cmp_schedules').select('content_item_id, platform'),
        supabase.from('cmp_campaigns').select('*').eq('status', 'active').order('name'),
      ])

      const platformsByItem: Record<string, Platform[]> = {}
      for (const s of schedulesData ?? []) {
        if (!platformsByItem[s.content_item_id]) platformsByItem[s.content_item_id] = []
        if (!platformsByItem[s.content_item_id].includes(s.platform as Platform)) {
          platformsByItem[s.content_item_id].push(s.platform as Platform)
        }
      }

      setItems(
        (contentData ?? []).map((item) => ({
          ...item,
          platforms: platformsByItem[item.id] ?? [],
        }))
      )
      setCampaigns(campaignData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false
    if (filterPlatform && !item.platforms.includes(filterPlatform)) return false
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
          <h2 className="text-[1.5rem] font-bold leading-tight">คลังคอนเทนต์</h2>
          <p className="text-[var(--muted)] text-sm mt-1">รวมทุก content ที่วางแผนและเผยแพร่แล้ว</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 min-w-[220px]"
            style={{ border: '1px solid var(--line)', borderRadius: '14px', background: 'white' }}
          >
            <span className="text-[var(--muted)]">⌕</span>
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือ caption..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none w-full text-sm bg-transparent"
            />
          </div>
          <Link
            href="/content/new"
            className="px-4 py-2.5 rounded-[14px] text-sm font-semibold text-white transition-all hover:-translate-y-px"
            style={{
              background: 'linear-gradient(135deg, #336bff, #4b91ff)',
              boxShadow: '0 14px 24px rgba(51,107,255,0.24)',
            }}
          >
            + สร้างคอนเทนต์
          </Link>
        </div>
      </section>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as ContentStatus | '')}
          label="สถานะ"
          options={[
            { value: '', label: 'ทุกสถานะ' },
            ...ALL_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          value={filterPlatform}
          onChange={(v) => setFilterPlatform(v as Platform | '')}
          label="แพลตฟอร์ม"
          options={[
            { value: '', label: 'ทุกแพลตฟอร์ม' },
            { value: 'fb', label: '🔵 Facebook' },
            { value: 'ig', label: '🟣 Instagram' },
            { value: 'tiktok', label: '⚫ TikTok' },
            { value: 'youtube', label: '🔴 YouTube' },
            { value: 'shopee', label: '🟠 Shopee' },
          ]}
        />
        <Select
          value={filterCampaign}
          onChange={(v) => setFilterCampaign(v)}
          label="แคมเปญ"
          options={[
            { value: '', label: 'ทุกแคมเปญ' },
            ...campaigns.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          value={filterType}
          onChange={(v) => setFilterType(v as ContentType | '')}
          label="ประเภท"
          options={[
            { value: '', label: 'ทุกประเภท' },
            ...ALL_CONTENT_TYPES.map((t) => ({ value: t, label: CONTENT_TYPE_LABELS[t] })),
          ]}
        />
        {(filterStatus || filterPlatform || filterCampaign || filterType || search) && (
          <button
            onClick={() => {
              setFilterStatus('')
              setFilterPlatform('')
              setFilterCampaign('')
              setFilterType('')
              setSearch('')
            }}
            className="px-3.5 py-2 text-sm text-[var(--muted)] rounded-[12px] border border-[var(--line)] bg-white hover:bg-gray-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.78)',
          borderRadius: '22px',
          padding: '20px',
          boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
        }}
      >
        {loading ? (
          <div className="text-center py-16 text-[var(--muted)]">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted)]">
            ไม่พบคอนเทนต์ที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left pb-3 text-[var(--muted)] font-medium">ชื่อ</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">ประเภท</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">แพลตฟอร์ม</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">สถานะ</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">วันที่สร้าง</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--line)] last:border-0 hover:bg-blue-50/40 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <Link href={`/content/${item.id}`} className="font-medium hover:text-[var(--brand)] transition-colors">
                      {item.title}
                    </Link>
                    {item.caption_main && (
                      <p className="text-[var(--muted)] text-xs mt-0.5 truncate max-w-[280px]">
                        {item.caption_main}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[var(--muted)]">
                    {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1">
                      {item.platforms.length > 0
                        ? item.platforms.map((p) => <PlatformIcon key={p} platform={p} />)
                        : <span className="text-[var(--muted)]">—</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3 text-[var(--muted)]">
                    {new Date(item.created_at).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-[var(--muted)] mt-4">
          {filtered.length} รายการ{filtered.length !== items.length && ` (จากทั้งหมด ${items.length})`}
        </p>
      </section>
    </>
  )
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <div
      className="flex items-center gap-2 px-3.5 py-2"
      style={{ border: '1px solid var(--line)', borderRadius: '14px', background: 'white' }}
    >
      <span className="text-xs text-[var(--muted)]">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 outline-none text-sm bg-transparent text-[var(--text)] cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
