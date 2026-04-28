'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ContentItemWithRelations, Schedule, PostAnalytics, ContentStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'

const PLATFORM_LABELS: Record<string, string> = {
  fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok',
  youtube: 'YouTube', shopee: 'Shopee', other: 'อื่นๆ',
}

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
        supabase
          .from('cmp_content_items')
          .select('*, campaign:cmp_campaigns(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('cmp_schedules')
          .select('*')
          .eq('content_item_id', id)
          .order('scheduled_at'),
      ])

      if (!content) { router.push('/content'); return }

      setItem(content as ContentItemWithRelations)
      setSchedules(schedData ?? [])

      if (schedData && schedData.length > 0) {
        const scheduleIds = schedData.map((s) => s.id)
        const { data: analyticsData } = await supabase
          .from('cmp_post_analytics')
          .select('*')
          .in('schedule_id', scheduleIds)
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
    const { data } = await supabase
      .from('cmp_content_items')
      .update({ status: next })
      .eq('id', id)
      .select()
      .single()
    if (data) setItem({ ...item, ...data })
    setUpdating(false)
  }

  async function archiveContent() {
    if (!item) return
    setUpdating(true)
    const { data } = await supabase
      .from('cmp_content_items')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single()
    if (data) setItem({ ...item, ...data })
    setUpdating(false)
  }

  if (loading) {
    return <div className="text-center py-20 text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

  const analyticsById = Object.fromEntries(analytics.map((a) => [a.schedule_id, a]))
  const nextStatus = NEXT_STATUS[item.status]

  return (
    <>
      {/* Topbar */}
      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '26px',
          padding: '18px 22px',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/content" className="text-sm text-[var(--muted)] hover:text-[var(--brand)]">
                ← คลังคอนเทนต์
              </Link>
            </div>
            <h2 className="text-[1.4rem] font-bold leading-tight">{item.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={item.status} />
              {item.campaign && (
                <span className="text-xs text-[var(--muted)] bg-gray-100 px-2.5 py-1 rounded-full">
                  {(item.campaign as any).name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {item.status !== 'archived' && item.status !== 'published' && (
              <button
                onClick={archiveContent}
                disabled={updating}
                className="px-4 py-2 rounded-[12px] text-sm border border-[var(--line)] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                เก็บถาวร
              </button>
            )}
            {nextStatus && (
              <button
                onClick={advanceStatus}
                disabled={updating}
                className="px-5 py-2 rounded-[12px] text-sm font-semibold text-white disabled:opacity-50 transition-all hover:-translate-y-px"
                style={{
                  background: 'linear-gradient(135deg, #336bff, #4b91ff)',
                  boxShadow: '0 10px 20px rgba(51,107,255,0.22)',
                }}
              >
                {updating ? '...' : STATUS_ACTION_LABELS[item.status]}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Main info */}
        <div className="flex flex-col gap-4">
          {/* Content info */}
          <Card title="ข้อมูลคอนเทนต์">
            <InfoRow label="ประเภท" value={item.content_type} />
            <InfoRow label="Caption">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {item.caption_main ?? <span className="text-[var(--muted)]">ไม่มี</span>}
              </p>
            </InfoRow>
            {item.tags && item.tags.length > 0 && (
              <InfoRow label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}
            <InfoRow label="วันที่สร้าง" value={new Date(item.created_at).toLocaleDateString('th-TH', { dateStyle: 'long' })} />
          </Card>

          {/* Schedules */}
          <Card title={`กำหนดการโพสต์ (${schedules.length})`}>
            {schedules.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์</p>
            ) : (
              <div className="flex flex-col gap-3">
                {schedules.map((s) => {
                  const a = analyticsById[s.id]
                  return (
                    <div key={s.id} className="p-3 rounded-[14px] border border-[var(--line)] bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={s.platform} showLabel />
                          <span className="text-sm text-[var(--muted)]">
                            {new Date(s.scheduled_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">{s.post_mode === 'auto' ? 'Auto' : 'Manual'}</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={
                              s.status === 'pending'
                                ? { background: 'rgba(143,107,255,0.12)', color: '#6b4eff' }
                                : s.status.includes('posted')
                                ? { background: 'rgba(31,191,117,0.12)', color: '#0d8a54' }
                                : { background: 'rgba(247,184,75,0.16)', color: '#a56a11' }
                            }
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>
                      {a && (
                        <div className="flex gap-4 mt-2 pt-2 border-t border-[var(--line)]">
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

        {/* Side info */}
        <div className="flex flex-col gap-4">
          <Card title="รายละเอียด">
            <InfoRow label="ID" value={item.id.slice(0, 8) + '...'} />
            <InfoRow label="สถานะ">
              <StatusBadge status={item.status} />
            </InfoRow>
            <InfoRow
              label="แคมเปญ"
              value={(item.campaign as any)?.name ?? 'ไม่ระบุ'}
            />
            <InfoRow
              label="อัปเดตล่าสุด"
              value={new Date(item.updated_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
            />
          </Card>
        </div>
      </div>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--panel)',
        border: '1px solid rgba(255,255,255,0.78)',
        borderRadius: '22px',
        padding: '20px',
        boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
      }}
    >
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-dashed border-[var(--line)] last:border-0 last:pb-0">
      <span className="text-sm text-[var(--muted)] w-24 flex-shrink-0">{label}</span>
      {value !== undefined ? <span className="text-sm">{value}</span> : children}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold">{value?.toLocaleString() ?? '—'}</p>
    </div>
  )
}
