'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItemWithRelations, Schedule, PostAnalytics, ContentStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

const NEXT_STATUS: Partial<Record<ContentStatus, ContentStatus>> = {
  draft: 'review',
  review: 'approved',
  approved: 'scheduled',
  scheduled: 'published',
  published: 'archived',
}

const STATUS_ACTION_LABELS: Partial<Record<ContentStatus, string>> = {
  draft: 'ส่งรีวิว',
  review: 'อนุมัติ',
  approved: 'กำหนดเผยแพร่',
  scheduled: 'ทำเครื่องหมายว่าเผยแพร่แล้ว',
  published: 'เก็บถาวร',
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<ContentItemWithRelations | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: content }, { data: schedData }] = await Promise.all([
        supabase.from('cmp_content_items').select('*, campaign:cmp_campaigns(*)').eq('id', id).single(),
        supabase.from('cmp_schedules').select('*').eq('content_item_id', id).order('scheduled_at'),
      ])

      if (!content) { router.push('/content'); return }

      setItem(content as ContentItemWithRelations)
      setSchedules(schedData ?? [])

      if (schedData && schedData.length > 0) {
        const scheduleIds = schedData.map((s) => s.id)
        const { data: analyticsData } = await supabase.from('cmp_post_analytics').select('*').in('schedule_id', scheduleIds)
        setAnalytics(analyticsData ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id, router])

  async function advanceStatus() {
    if (!item) return
    const next = NEXT_STATUS[item.status]
    if (!next) return
    setUpdating(true)
    const { data } = await supabase.from('cmp_content_items').update({ status: next }).eq('id', id).select().single()
    if (data) setItem({ ...item, ...data })
    setUpdating(false)
  }

  async function archiveContent() {
    if (!item) return
    setUpdating(true)
    const { data } = await supabase.from('cmp_content_items').update({ status: 'archived' }).eq('id', id).select().single()
    if (data) setItem({ ...item, ...data })
    setUpdating(false)
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

  const analyticsById = Object.fromEntries(analytics.map((a) => [a.schedule_id, a]))
  const nextStatus = NEXT_STATUS[item.status]

  return (
    <>
      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/content" className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]">
              ← คลังคอนเทนต์
            </Link>
            <h2 className="mt-3 text-[1.6rem] font-semibold leading-tight text-slate-950">{item.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={item.status} />
              {item.campaign && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[var(--muted)]">
                  {(item.campaign as any).name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {item.status !== 'archived' && item.status !== 'published' && (
              <button onClick={archiveContent} disabled={updating} className="secondary-button px-4 py-2 text-sm disabled:opacity-50">
                เก็บถาวร
              </button>
            )}
            {nextStatus && (
              <button onClick={advanceStatus} disabled={updating} className="primary-button px-5 py-2 text-sm font-semibold disabled:opacity-50">
                {updating ? '...' : STATUS_ACTION_LABELS[item.status]}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card title="ข้อมูลคอนเทนต์">
            <InfoRow label="ประเภท" value={item.content_type} />
            <InfoRow label="Caption">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-900">
                {item.caption_main ?? <span className="text-[var(--muted)]">ไม่มี</span>}
              </p>
            </InfoRow>
            {item.tags && item.tags.length > 0 && (
              <InfoRow label="Tags">
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}
            <InfoRow label="วันที่สร้าง" value={new Date(item.created_at).toLocaleDateString('th-TH', { dateStyle: 'long' })} />
          </Card>

          <Card title={`กำหนดการโพสต์ (${schedules.length})`}>
            {schedules.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์</p>
            ) : (
              <div className="flex flex-col gap-3">
                {schedules.map((s) => {
                  const a = analyticsById[s.id]
                  return (
                    <div key={s.id} className="surface-muted p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={s.platform} showLabel />
                          <span className="text-sm text-[var(--muted)]">
                            {new Date(s.scheduled_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">{s.post_mode === 'auto' ? 'Auto' : 'Manual'}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.status === 'pending'
                              ? 'bg-violet-100 text-violet-700'
                              : s.status.includes('posted')
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                      {a && (
                        <div className="mt-3 grid gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-4">
                          <Metric label="Reach" value={a.reach} />
                          <Metric label="Likes" value={a.likes} />
                          <Metric label="Comments" value={a.comments} />
                          <Metric label="Shares" value={a.shares} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="รายละเอียด">
            <InfoRow label="ID" value={item.id.slice(0, 8) + '...'} />
            <InfoRow label="สถานะ">
              <StatusBadge status={item.status} />
            </InfoRow>
            <InfoRow label="แคมเปญ" value={(item.campaign as any)?.name ?? 'ไม่ระบุ'} />
            <InfoRow label="อัปเดตล่าสุด" value={new Date(item.updated_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} />
          </Card>
        </div>
      </div>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5 md:p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-950">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-dashed border-[var(--line)] py-2 last:border-0 last:pb-0">
      <span className="w-24 flex-shrink-0 text-sm text-[var(--muted)]">{label}</span>
      {value !== undefined ? <span className="text-sm text-slate-900">{value}</span> : children}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[12px] bg-white px-3 py-2 text-center">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value?.toLocaleString() ?? '—'}</p>
    </div>
  )
}
