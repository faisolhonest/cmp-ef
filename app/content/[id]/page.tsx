'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItemWithRelations, Schedule, PostAnalytics, ContentStatus, Platform, PostMode } from '@/lib/types'
import { getPublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'อื่นๆ' },
]
const AUTO_PLATFORMS: Platform[] = ['fb', 'ig']

const ALL_STATUSES: ContentStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived']

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<ContentItemWithRelations | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [addingSchedule, setAddingSchedule] = useState(false)
  const [newSched, setNewSched] = useState<{ platform: Platform; scheduled_at: string; post_mode: PostMode }>({
    platform: 'fb',
    scheduled_at: '',
    post_mode: 'auto',
  })

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

  async function updateStatus(next: ContentStatus) {
    if (!item || next === item.status) return
    setUpdating(true)
    const { data } = await supabase.from('cmp_content_items').update({ status: next }).eq('id', id).select().single()
    if (data) {
      setItem({ ...item, ...data })
      setToast(`สถานะเปลี่ยนเป็น ${STATUS_LABELS[next]}`)
      setTimeout(() => setToast(null), 2500)
    }
    setUpdating(false)
  }

  function startEditSchedule(s: Schedule) {
    // datetime-local input expects "YYYY-MM-DDTHH:MM" in local time
    const local = new Date(s.scheduled_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    const value = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
    setEditingScheduleId(s.id)
    setEditingValue(value)
  }

  async function markAsPosted(scheduleId: string) {
    const { data } = await supabase
      .from('cmp_schedules')
      .update({ status: 'manually_posted' })
      .eq('id', scheduleId)
      .select()
      .single()
    if (data) {
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, status: 'manually_posted' as const } : s))
      setToast('บันทึกว่าโพสต์เรียบร้อยแล้ว')
      setTimeout(() => setToast(null), 2500)
    }
  }

  async function retrySchedule(scheduleId: string) {
    const { data } = await supabase
      .from('cmp_schedules')
      .update({ status: 'pending' })
      .eq('id', scheduleId)
      .select()
      .single()
    if (data) {
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, status: 'pending' as const } : s))
      setToast('รีเซ็ตสถานะเพื่อลองใหม่แล้ว')
      setTimeout(() => setToast(null), 2500)
    }
  }

  async function saveNewSchedule() {
    if (!newSched.scheduled_at) return
    const { data } = await supabase
      .from('cmp_schedules')
      .insert({
        content_item_id: id,
        platform: newSched.platform,
        scheduled_at: new Date(newSched.scheduled_at).toISOString(),
        post_mode: newSched.post_mode,
        status: 'pending' as const,
      })
      .select()
      .single()
    if (data) {
      setSchedules((prev) => [...prev, data as Schedule])
      setNewSched({ platform: 'fb', scheduled_at: '', post_mode: 'auto' })
      setAddingSchedule(false)
      setToast('เพิ่มกำหนดการโพสต์แล้ว')
      setTimeout(() => setToast(null), 2500)
    }
  }

  async function saveSchedule(scheduleId: string) {
    if (!editingValue) return
    const { data } = await supabase
      .from('cmp_schedules')
      .update({ scheduled_at: new Date(editingValue).toISOString() })
      .eq('id', scheduleId)
      .select()
      .single()
    if (data) {
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, scheduled_at: data.scheduled_at } : s))
      setToast('บันทึกเวลาโพสต์เรียบร้อย')
      setTimeout(() => setToast(null), 2500)
    }
    setEditingScheduleId(null)
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

  const analyticsById = Object.fromEntries(analytics.map((a) => [a.schedule_id, a]))
  const publishingStatus = getPublishingStatus(schedules)

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          {toast}
        </div>
      )}

      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/content" className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]">
              ← คลังคอนเทนต์
            </Link>
            <h2 className="mt-3 text-[1.6rem] font-semibold leading-tight text-slate-950">{item.title}</h2>
            {item.campaign && (
              <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[var(--muted)]">
                {(item.campaign as any).name}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--muted)]">Publishing</label>
              <div className="input-shell flex items-center gap-2 px-3 py-2">
                <StatusBadge status={publishingStatus} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--muted)]">Workflow</label>
              <div className="input-shell flex items-center gap-2 px-3 py-2">
                <StatusBadge status={item.status} />
                <select
                  value={item.status}
                  disabled={updating}
                  onChange={(e) => updateStatus(e.target.value as ContentStatus)}
                  className="cursor-pointer border-0 bg-transparent text-sm font-medium text-[var(--text)] outline-none disabled:opacity-50"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
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
            {schedules.length === 0 && !addingSchedule && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์</p>
            )}
            {schedules.length > 0 && (
              <div className="flex flex-col gap-3">
                {schedules.map((s) => {
                  const a = analyticsById[s.id]
                  const isEditing = editingScheduleId === s.id
                  return (
                    <div key={s.id} className="surface-muted p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={s.platform} showLabel />
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="datetime-local"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="input-shell rounded-[10px] px-2.5 py-1.5 text-sm text-slate-900"
                              />
                              <button onClick={() => saveSchedule(s.id)} className="primary-button px-3 py-1.5 text-xs font-semibold">
                                บันทึก
                              </button>
                              <button onClick={() => setEditingScheduleId(null)} className="secondary-button px-3 py-1.5 text-xs">
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditSchedule(s)}
                              className="group flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-slate-900"
                            >
                              {new Date(s.scheduled_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                              <PencilIcon />
                            </button>
                          )}
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
                          {s.post_mode === 'manual' && s.status === 'pending' && (
                            <button
                              onClick={() => markAsPosted(s.id)}
                              className="secondary-button px-3 py-1.5 text-xs font-medium"
                            >
                              Mark as Posted
                            </button>
                          )}
                          {s.status === 'failed' && (
                            <button
                              onClick={() => retrySchedule(s.id)}
                              className="secondary-button px-3 py-1.5 text-xs font-medium"
                            >
                              Retry
                            </button>
                          )}
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
            {addingSchedule ? (
              <div className="surface-muted flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <select
                  value={newSched.platform}
                  onChange={(e) => {
                    const platform = e.target.value as Platform
                    setNewSched({ ...newSched, platform, post_mode: AUTO_PLATFORMS.includes(platform) ? 'auto' : 'manual' })
                  }}
                  className="input-shell px-3 py-2 text-sm outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={newSched.scheduled_at}
                  onChange={(e) => setNewSched({ ...newSched, scheduled_at: e.target.value })}
                  className="input-shell px-3 py-2 text-sm outline-none"
                />
                <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                  newSched.post_mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {newSched.post_mode === 'auto' ? 'Auto (n8n)' : 'Manual'}
                </span>
                <div className="flex gap-2 lg:ml-auto">
                  <button onClick={saveNewSchedule} className="primary-button px-3 py-1.5 text-xs font-semibold">
                    บันทึก
                  </button>
                  <button onClick={() => setAddingSchedule(false)} className="secondary-button px-3 py-1.5 text-xs">
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingSchedule(true)}
                className="secondary-button px-3 py-1.5 text-sm font-medium text-[var(--brand)]"
              >
                + เพิ่มแพลตฟอร์ม
              </button>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="รายละเอียด">
            <InfoRow label="ID" value={item.id.slice(0, 8) + '...'} />
            <InfoRow label="Publishing">
              <StatusBadge status={publishingStatus} />
            </InfoRow>
            <InfoRow label="Workflow">
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" className="opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true">
      <path d="M11 2.5 13.5 5 5.5 13H3v-2.5L11 2.5Z" />
    </svg>
  )
}
