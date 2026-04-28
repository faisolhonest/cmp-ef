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
      const { data } = await supabase
        .from('cmp_post_analytics')
        .select(`
          id, reach, likes, comments, shares, fetched_at,
          schedule:cmp_schedules(platform, scheduled_at,
            content_item:cmp_content_items(title))
        `)
        .order('fetched_at', { ascending: false })

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
      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">Analytics</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">ผลลัพธ์ของโพสต์ที่เผยแพร่แล้ว</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value as Platform | '')} className="input-shell px-3.5 py-2 text-sm outline-none">
              <option value="">ทุกแพลตฟอร์ม</option>
              <option value="fb">Facebook</option>
              <option value="ig">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-shell px-3.5 py-2 text-sm outline-none" />
            <span className="text-sm text-[var(--muted)]">ถึง</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-shell px-3.5 py-2 text-sm outline-none" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Reach รวม', value: totals.reach, tone: 'text-blue-600' },
          { label: 'Likes รวม', value: totals.likes, tone: 'text-emerald-600' },
          { label: 'Comments รวม', value: totals.comments, tone: 'text-amber-600' },
          { label: 'Shares รวม', value: totals.shares, tone: 'text-violet-600' },
        ].map(({ label, value, tone }) => (
          <article key={label} className="surface-card p-5">
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <strong className={`mt-3 block text-[1.9rem] font-semibold ${tone}`}>{value.toLocaleString()}</strong>
            <span className="mt-1 block text-xs text-[var(--muted)]">{filtered.length} โพสต์</span>
          </article>
        ))}
      </div>

      <section className="surface-card p-5 md:p-6">
        {loading ? (
          <p className="py-12 text-center text-[var(--muted)]">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล Analytics</p>
        ) : (
          <div className="table-shell">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">ชื่อโพสต์</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">แพลตฟอร์ม</th>
                  <th className="pb-3 text-right font-medium text-[var(--muted)]">Reach</th>
                  <th className="pb-3 text-right font-medium text-[var(--muted)]">Likes</th>
                  <th className="pb-3 text-right font-medium text-[var(--muted)]">Comments</th>
                  <th className="pb-3 text-right font-medium text-[var(--muted)]">Shares</th>
                  <th className="pb-3 text-left font-medium text-[var(--muted)]">วันที่โพสต์</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--line)] last:border-0 hover:bg-slate-50">
                    <td className="py-4 pr-4 font-medium text-slate-900">{row.title}</td>
                    <td className="py-4 pr-4">
                      <PlatformIcon platform={row.platform} showLabel />
                    </td>
                    <td className="py-4 pr-4 text-right">{row.reach?.toLocaleString() ?? '—'}</td>
                    <td className="py-4 pr-4 text-right">{row.likes?.toLocaleString() ?? '—'}</td>
                    <td className="py-4 pr-4 text-right">{row.comments?.toLocaleString() ?? '—'}</td>
                    <td className="py-4 pr-4 text-right">{row.shares?.toLocaleString() ?? '—'}</td>
                    <td className="py-4 text-[var(--muted)]">
                      {row.scheduled_at
                        ? new Date(row.scheduled_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
