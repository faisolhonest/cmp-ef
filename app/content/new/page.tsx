'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Campaign, Platform, ContentType, PostMode } from '@/lib/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: '🔵 Facebook' },
  { value: 'ig', label: '🟣 Instagram' },
  { value: 'tiktok', label: '⚫ TikTok' },
  { value: 'youtube', label: '🔴 YouTube' },
  { value: 'shopee', label: '🟠 Shopee' },
  { value: 'other', label: '⚪ อื่นๆ' },
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
    setSchedules((prev) => [
      ...prev,
      { platform: 'fb', scheduled_at: '', post_mode: 'auto' },
    ])
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
        <h2 className="text-[1.5rem] font-bold leading-tight">สร้างคอนเทนต์ใหม่</h2>
        <p className="text-[var(--muted)] text-sm mt-1">เพิ่มคอนเทนต์และกำหนดเวลาโพสต์</p>
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Main form */}
        <section
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(255,255,255,0.78)',
            borderRadius: '22px',
            padding: '24px',
            boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
          }}
        >
          <h3 className="font-semibold mb-5">ข้อมูลคอนเทนต์</h3>
          <div className="flex flex-col gap-4">
            <Field label="ชื่อคอนเทนต์ *">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น โปรโมชัน 5.5 ลอตสุดท้าย"
                className="w-full px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm focus:border-[var(--brand)] transition-colors"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="ประเภทคอนเทนต์">
                <select
                  value={form.content_type}
                  onChange={(e) => setForm({ ...form, content_type: e.target.value as ContentType })}
                  className="w-full px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm"
                >
                  <option value="post">โพสต์</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="video">วิดีโอ</option>
                  <option value="live_teaser">Live Teaser</option>
                </select>
              </Field>

              <Field label="แคมเปญ">
                <select
                  value={form.campaign_id}
                  onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm"
                >
                  <option value="">ไม่ระบุแคมเปญ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Caption">
              <textarea
                value={form.caption_main}
                onChange={(e) => setForm({ ...form, caption_main: e.target.value })}
                placeholder="ข้อความสำหรับโพสต์..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm resize-none focus:border-[var(--brand)] transition-colors"
              />
            </Field>

            <Field label="Tags (คั่นด้วยจุลภาค)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="เช่น โปรโมชัน, EF, เกษตร"
                className="w-full px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm focus:border-[var(--brand)] transition-colors"
              />
            </Field>
          </div>
        </section>

        {/* Schedules */}
        <section
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(255,255,255,0.78)',
            borderRadius: '22px',
            padding: '24px',
            boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
          }}
        >
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold">กำหนดเวลาโพสต์</h3>
            <button
              type="button"
              onClick={addSchedule}
              className="text-sm text-[var(--brand)] font-semibold px-3 py-1.5 rounded-[10px] border border-[var(--brand)] hover:bg-blue-50 transition-colors"
            >
              + เพิ่มแพลตฟอร์ม
            </button>
          </div>

          {schedules.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์ — กด &quot;เพิ่มแพลตฟอร์ม&quot; เพื่อเพิ่ม</p>
          ) : (
            <div className="flex flex-col gap-3">
              {schedules.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-[14px] border border-[var(--line)] bg-white">
                  <select
                    value={s.platform}
                    onChange={(e) => updateSchedule(i, { platform: e.target.value as Platform })}
                    className="px-3 py-2 rounded-[10px] border border-[var(--line)] outline-none text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={s.scheduled_at}
                    onChange={(e) => updateSchedule(i, { scheduled_at: e.target.value })}
                    className="px-3 py-2 rounded-[10px] border border-[var(--line)] outline-none text-sm"
                  />
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={
                      s.post_mode === 'auto'
                        ? { background: 'rgba(31,191,117,0.12)', color: '#0d8a54' }
                        : { background: 'rgba(247,184,75,0.16)', color: '#a56a11' }
                    }
                  >
                    {s.post_mode === 'auto' ? 'Auto (n8n)' : 'Manual'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSchedule(i)}
                    className="ml-auto text-[var(--muted)] hover:text-red-500 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="text-red-500 text-sm px-2">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-[14px] border border-[var(--line)] text-sm hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-[14px] text-sm font-semibold text-white disabled:opacity-50 transition-all hover:-translate-y-px"
            style={{
              background: 'linear-gradient(135deg, #336bff, #4b91ff)',
              boxShadow: '0 14px 24px rgba(51,107,255,0.24)',
            }}
          >
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
