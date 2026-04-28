'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Platform } from '@/lib/types'
import PlatformIcon from '@/components/PlatformIcon'

type AnalyticsRow = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  fetched_at: string
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPlatform, setFilterPlatform] = useState<Platform | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('cmp_post_analytics')
        .select(`
          id, reach, likes, comments, shares, fetched_at,
          schedule:cmp_schedules(platform, scheduled_at,
            content_item:cmp_content_items(title))
        `)
        .order('fetched_at', { ascending: false })

      const { data } = await query

      setRows(
        (data ?? []).map((a: any) => ({
          id: a.id,
          title: a.schedule?.content_item?.title ?? '—',
          platform: a.schedule?.platform as Platform,
          scheduled_at: a.schedule?.scheduled_at ?? '',
          reach: a.reach,
          likes: a.likes,
          comments: a.comments,
          shares: a.shares,
          fetched_at: a.fetched_at,
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rows.filter((r) => {
    if (filterPlatform && r.platform !== filterPlatform) return false
    if (dateFrom && r.scheduled_at < dateFrom) return false
    if (dateTo && r.scheduled_at > dateTo + 'T23:59:59') return false
    return true
  })

  const totals = filtered.reduce(
    (acc, r) => ({
      reach: acc.reach + (r.reach ?? 0),
      likes: acc.likes + (r.likes ?? 0),
      comments: acc.comments + (r.comments ?? 0),
      shares: acc.shares + (r.shares ?? 0),
    }),
    { reach: 0, likes: 0, comments: 0, shares: 0 }
  )

  return (
    <>
      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '26px',
          padding: '18px 22px',
          backdropFilter: 'blur(18px)',
        }}
        className="flex justify-between items-center gap-4 flex-wrap"
      >
        <div>
          <h2 className="text-[1.5rem] font-bold leading-tight">Analytics</h2>
          <p className="text-[var(--muted)] text-sm mt-1">ผลลัพธ์ของโพสต์ที่เผยแพร่แล้ว</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value as Platform | '')}
            className="px-3.5 py-2 rounded-[12px] border border-[var(--line)] outline-none text-sm bg-white"
          >
            <option value="">ทุกแพลตฟอร์ม</option>
            <option value="fb">🔵 Facebook</option>
            <option value="ig">🟣 Instagram</option>
            <option value="tiktok">⚫ TikTok</option>
            <option value="youtube">🔴 YouTube</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3.5 py-2 rounded-[12px] border border-[var(--line)] outline-none text-sm bg-white"
          />
          <span className="text-[var(--muted)] text-sm">ถึง</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3.5 py-2 rounded-[12px] border border-[var(--line)] outline-none text-sm bg-white"
          />
        </div>
      </section>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Reach รวม', value: totals.reach, color: '#2f66ff' },
          { label: 'Likes รวม', value: totals.likes, color: '#1fbf75' },
          { label: 'Comments รวม', value: totals.comments, color: '#f7b84b' },
          { label: 'Shares รวม', value: totals.shares, color: '#8f6bff' },
        ].map(({ label, value, color }) => (
          <article
            key={label}
            style={{
              background: 'var(--panel)',
              border: '1px solid rgba(255,255,255,0.78)',
              borderRadius: '22px',
              padding: '18px',
              boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
            }}
          >
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <strong className="block text-[1.8rem] mt-2" style={{ color }}>
              {value.toLocaleString()}
            </strong>
            <span className="text-xs text-[var(--muted)]">{filtered.length} โพสต์</span>
          </article>
        ))}
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
          <p className="text-center py-12 text-[var(--muted)]">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted)]">ไม่พบข้อมูล Analytics</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left pb-3 text-[var(--muted)] font-medium">ชื่อโพสต์</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">แพลตฟอร์ม</th>
                <th className="text-right pb-3 text-[var(--muted)] font-medium">Reach</th>
                <th className="text-right pb-3 text-[var(--muted)] font-medium">Likes</th>
                <th className="text-right pb-3 text-[var(--muted)] font-medium">Comments</th>
                <th className="text-right pb-3 text-[var(--muted)] font-medium">Shares</th>
                <th className="text-left pb-3 text-[var(--muted)] font-medium">วันที่โพสต์</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0 hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 pr-4 font-medium">{row.title}</td>
                  <td className="py-3 pr-4">
                    <PlatformIcon platform={row.platform} showLabel />
                  </td>
                  <td className="py-3 pr-4 text-right">{row.reach?.toLocaleString() ?? '—'}</td>
                  <td className="py-3 pr-4 text-right">{row.likes?.toLocaleString() ?? '—'}</td>
                  <td className="py-3 pr-4 text-right">{row.comments?.toLocaleString() ?? '—'}</td>
                  <td className="py-3 pr-4 text-right">{row.shares?.toLocaleString() ?? '—'}</td>
                  <td className="py-3 text-[var(--muted)]">
                    {row.scheduled_at
                      ? new Date(row.scheduled_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
