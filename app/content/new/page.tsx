'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Campaign, Platform, ContentType, PostMode } from '@/lib/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'อื่นๆ' },
]

const AUTO_PLATFORMS: Platform[] = ['fb', 'ig']

type ScheduleRow = {
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
}

export default function NewContentPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    content_type: 'post' as ContentType,
    caption_main: '',
    tags: '',
    campaign_id: '',
  })

  const [schedules, setSchedules] = useState<ScheduleRow[]>([])

  useEffect(() => {
    supabase.from('cmp_campaigns').select('*').eq('status', 'active').order('name')
      .then(({ data }) => setCampaigns(data ?? []))
  }, [])

  function addSchedule() {
    setSchedules((prev) => [...prev, { platform: 'fb', scheduled_at: '', post_mode: 'auto' }])
  }

  function removeSchedule(i: number) {
    setSchedules((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateSchedule(i: number, patch: Partial<ScheduleRow>) {
    setSchedules((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        const updated = { ...s, ...patch }
        if (patch.platform) {
          updated.post_mode = AUTO_PLATFORMS.includes(patch.platform) ? 'auto' : 'manual'
        }
        return updated
      })
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('กรุณาใส่ชื่อคอนเทนต์'); return }
    setSaving(true)
    setError('')

    const { data: item, error: itemErr } = await supabase
      .from('cmp_content_items')
      .insert({
        title: form.title.trim(),
        content_type: form.content_type,
        caption_main: form.caption_main.trim() || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
        campaign_id: form.campaign_id || null,
        status: 'draft',
      })
      .select()
      .single()

    if (itemErr || !item) {
      setError(itemErr?.message ?? 'เกิดข้อผิดพลาด')
      setSaving(false)
      return
    }

    if (schedules.length > 0) {
      const validSchedules = schedules.filter((s) => s.scheduled_at)
      if (validSchedules.length > 0) {
        await supabase.from('cmp_schedules').insert(
          validSchedules.map((s) => ({
            content_item_id: item.id,
            platform: s.platform,
            scheduled_at: s.scheduled_at,
            post_mode: s.post_mode,
            status: 'pending' as const,
          }))
        )
      }
    }

    router.push(`/content/${item.id}`)
  }

  return (
    <>
      <section className="page-header">
        <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">สร้างคอนเทนต์ใหม่</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">เพิ่มคอนเทนต์และกำหนดเวลาโพสต์</p>
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <section className="surface-card p-5 md:p-6">
          <h3 className="mb-5 text-base font-semibold text-slate-950">ข้อมูลคอนเทนต์</h3>
          <div className="flex flex-col gap-4">
            <Field label="ชื่อคอนเทนต์ *">
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น โปรโมชั่น 5.5 ลอตสุดท้าย" className="input-shell w-full px-4 py-2.5 text-sm outline-none" />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ประเภทคอนเทนต์">
                <select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value as ContentType })} className="input-shell w-full px-4 py-2.5 text-sm outline-none">
                  <option value="post">โพสต์</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="video">วิดีโอ</option>
                  <option value="live_teaser">Live Teaser</option>
                </select>
              </Field>

              <Field label="แคมเปญ">
                <select value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} className="input-shell w-full px-4 py-2.5 text-sm outline-none">
                  <option value="">ไม่ระบุแคมเปญ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Caption">
              <textarea value={form.caption_main} onChange={(e) => setForm({ ...form, caption_main: e.target.value })} placeholder="ข้อความสำหรับโพสต์..." rows={4} className="input-shell w-full resize-none px-4 py-2.5 text-sm outline-none" />
            </Field>

            <Field label="Tags (คั่นด้วยจุลภาค)">
              <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="เช่น โปรโมชั่น, EF, เกษตร" className="input-shell w-full px-4 py-2.5 text-sm outline-none" />
            </Field>
          </div>
        </section>

        <section className="surface-card p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">กำหนดเวลาโพสต์</h3>
            <button type="button" onClick={addSchedule} className="secondary-button px-3 py-1.5 text-sm font-medium text-[var(--brand)]">
              + เพิ่มแพลตฟอร์ม
            </button>
          </div>

          {schedules.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์ — กด &quot;เพิ่มแพลตฟอร์ม&quot; เพื่อเพิ่ม</p>
          ) : (
            <div className="flex flex-col gap-3">
              {schedules.map((s, i) => (
                <div key={i} className="surface-muted flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <select value={s.platform} onChange={(e) => updateSchedule(i, { platform: e.target.value as Platform })} className="input-shell px-3 py-2 text-sm outline-none">
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <input type="datetime-local" value={s.scheduled_at} onChange={(e) => updateSchedule(i, { scheduled_at: e.target.value })} className="input-shell px-3 py-2 text-sm outline-none" />
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${s.post_mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.post_mode === 'auto' ? 'Auto (n8n)' : 'Manual'}
                  </span>
                  <button type="button" onClick={() => removeSchedule(i)} className="text-lg leading-none text-[var(--muted)] transition-colors hover:text-red-500 lg:ml-auto">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="px-2 text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="secondary-button px-5 py-2.5 text-sm">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="primary-button px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึกคอนเทนต์'}
          </button>
        </div>
      </form>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--text)]">{label}</label>
      {children}
    </div>
  )
}
