'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AssetType, Campaign, ContentType, Platform, PostMode } from '@/lib/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'อื่นๆ' },
]

const AUTO_PLATFORMS: Platform[] = ['fb', 'ig']
const MEDIA_TYPES: { value: CreateAssetType; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
]

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'Text',
  reel: 'Reel',
  story: 'Story',
  video: 'วิดีโอ',
  live_teaser: 'Live Teaser',
}

type CreateAssetType = Extract<AssetType, 'image' | 'video' | 'reel' | 'story'>

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; description: string }[] = [
  { value: 'post', label: 'Text', description: 'โพสต์ข้อความ หรือ feed post พร้อมรูป' },
  { value: 'reel', label: 'Reel', description: 'วิดีโอแนวตั้ง 9:16' },
  { value: 'story', label: 'Story', description: 'Story 9:16 สำหรับ FB/IG' },
  { value: 'video', label: 'Video', description: 'วิดีโอ feed / long form' },
  { value: 'live_teaser', label: 'Live Teaser', description: 'คอนเทนต์โปรโมตไลฟ์' },
]

type ScheduleRow = {
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
}

type MediaForm = {
  asset_type: CreateAssetType
  url: string
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
  const [media, setMedia] = useState<MediaForm>({ asset_type: 'image', url: '' })
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])

  const mediaUrl = media.url.trim()
  const mediaUrlError = mediaUrl && !isHttpsUrl(mediaUrl) ? 'กรุณาใช้ URL แบบ https:// ที่เปิดสาธารณะได้' : ''
  const primarySchedule = schedules[0]
  const previewPlatform = primarySchedule?.platform ?? 'fb'
  const parsedTags = useMemo(() => parseTags(form.tags), [form.tags])

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

  function updateContentType(content_type: ContentType) {
    setForm((prev) => ({ ...prev, content_type }))
    if (content_type === 'reel' || content_type === 'story' || content_type === 'video') {
      setMedia((prev) => ({ ...prev, asset_type: content_type === 'video' ? 'video' : content_type }))
    }
  }

  function updateMediaType(asset_type: CreateAssetType) {
    setMedia((prev) => ({ ...prev, asset_type }))
    if (asset_type === 'reel' || asset_type === 'story' || asset_type === 'video') {
      setForm((prev) => ({ ...prev, content_type: asset_type === 'video' ? 'video' : asset_type }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('กรุณาใส่ชื่อคอนเทนต์'); return }
    if (mediaUrlError) { setError(mediaUrlError); return }

    setSaving(true)
    setError('')

    let assetIds: string[] | null = null
    if (mediaUrl) {
      const { data: asset, error: assetErr } = await supabase
        .from('cmp_assets')
        .insert({
          name: createAssetName(form.title, mediaUrl),
          asset_type: media.asset_type,
          url: mediaUrl,
          thumbnail_url: media.asset_type === 'image' || (media.asset_type === 'story' && isLikelyImageUrl(mediaUrl)) ? mediaUrl : null,
          tags: parsedTags.length > 0 ? parsedTags : null,
        })
        .select('id')
        .single()

      if (assetErr || !asset) {
        setError(assetErr?.message ?? 'บันทึก media ไม่สำเร็จ')
        setSaving(false)
        return
      }

      assetIds = [asset.id]
    }

    const { data: item, error: itemErr } = await supabase
      .from('cmp_content_items')
      .insert({
        title: form.title.trim(),
        content_type: form.content_type,
        caption_main: form.caption_main.trim() || null,
        asset_ids: assetIds,
        tags: parsedTags.length > 0 ? parsedTags : null,
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
            scheduled_at: new Date(s.scheduled_at).toISOString(),
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
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">Create Content</p>
          <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">สร้างคอนเทนต์ใหม่</h2>
          <p className="text-sm text-[var(--muted)]">เตรียม caption, media และกำหนดเวลาโพสต์ในหน้าเดียว</p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="new-content-layout">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="surface-card p-5 md:p-6">
            <SectionHeader title="ข้อมูลคอนเทนต์" eyebrow="Content" />
            <div className="flex flex-col gap-4">
              <Field label="ชื่อคอนเทนต์ *">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="เช่น โปรโมชั่น 5.5 ลอตสุดท้าย"
                  className="input-shell w-full px-4 py-3 text-sm outline-none"
                />
              </Field>

              <Field label="ประเภทคอนเทนต์">
                <div className="content-type-grid">
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={form.content_type === option.value}
                      data-active={form.content_type === option.value}
                      onClick={() => updateContentType(option.value)}
                      className="content-type-card"
                    >
                      <span>{option.label}</span>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="แคมเปญ">
                  <select
                    value={form.campaign_id}
                    onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
                    className="input-shell w-full px-4 py-3 text-sm outline-none"
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
                  rows={5}
                  className="input-shell w-full resize-none px-4 py-3 text-sm leading-6 outline-none"
                />
              </Field>
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <SectionHeader title="Media / Assets" eyebrow="Asset" />
            <div className="flex flex-col gap-4">
              <Field label="ประเภทสื่อ">
                <div className="segmented-control w-fit max-w-full flex-wrap">
                  {MEDIA_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      data-active={media.asset_type === type.value}
                      onClick={() => updateMediaType(type.value)}
                      className="segmented-option text-sm"
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Public HTTPS media URL">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    value={media.url}
                    onChange={(e) => setMedia({ ...media, url: e.target.value })}
                    placeholder="https://example.com/media.jpg"
                    className="input-shell min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                  />
                  {media.url && (
                    <button
                      type="button"
                      onClick={() => setMedia({ ...media, url: '' })}
                      className="secondary-button px-4 py-2.5 text-sm"
                    >
                      ลบสื่อ
                    </button>
                  )}
                </div>
                {mediaUrlError && <p className="mt-2 text-xs font-medium text-red-600">{mediaUrlError}</p>}
              </Field>

              {mediaUrl && !mediaUrlError && (
                <div className="asset-preview-row">
                  <MediaFrame
                    url={mediaUrl}
                    assetType={media.asset_type}
                    contentType={form.content_type}
                    compact
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">{MEDIA_TYPES.find((type) => type.value === media.asset_type)?.label}</p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">{mediaUrl}</p>
                    <p className="mt-3 text-xs font-medium text-emerald-700">พร้อมบันทึกเป็น cmp_assets และเชื่อมกับ asset_ids</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <SectionHeader title="Tags" eyebrow="Metadata" />
            <Field label="Tags (คั่นด้วยจุลภาค)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="เช่น โปรโมชั่น, EF, เกษตร"
                className="input-shell w-full px-4 py-3 text-sm outline-none"
              />
            </Field>
          </section>

          <section className="surface-card p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader title="กำหนดเวลาโพสต์" eyebrow="Schedule" compact />
              <button type="button" onClick={addSchedule} className="secondary-button w-fit px-4 py-2 text-sm font-medium text-[var(--brand)]">
                + เพิ่มแพลตฟอร์ม
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="surface-muted px-4 py-5 text-sm text-[var(--muted)]">
                ยังไม่มีกำหนดการโพสต์
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {schedules.map((s, i) => (
                  <div key={i} className="schedule-row">
                    <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[170px_minmax(220px,1fr)_150px]">
                      <MiniField label="ช่องทาง">
                        <select
                          value={s.platform}
                          onChange={(e) => updateSchedule(i, { platform: e.target.value as Platform })}
                          className="input-shell w-full px-3.5 py-3 text-sm outline-none"
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </MiniField>
                      <MiniField label="วันและเวลา">
                        <input
                          type="datetime-local"
                          value={s.scheduled_at}
                          onChange={(e) => updateSchedule(i, { scheduled_at: e.target.value })}
                          className="input-shell w-full px-3.5 py-3 text-sm font-medium text-slate-900 outline-none"
                        />
                      </MiniField>
                      <MiniField label="โหมด">
                        <span className={`schedule-mode-pill ${s.post_mode === 'auto' ? 'schedule-mode-auto' : 'schedule-mode-manual'}`}>
                          {s.post_mode === 'auto' ? 'โพสต์อัตโนมัติ' : 'โพสต์เอง'}
                        </span>
                      </MiniField>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSchedule(i)}
                      className="schedule-remove-button"
                      aria-label="ลบกำหนดการโพสต์"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && <p className="px-2 text-sm font-medium text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => router.back()} className="secondary-button px-5 py-3 text-sm">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving} className="primary-button px-6 py-3 text-sm font-semibold disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึกคอนเทนต์'}
            </button>
          </div>
        </div>

        <aside className="new-content-preview-column">
          <PostPreview
            caption={form.caption_main}
            contentType={form.content_type}
            media={media}
            mediaUrl={mediaUrl && !mediaUrlError ? mediaUrl : ''}
            platform={previewPlatform}
            schedule={primarySchedule?.scheduled_at ?? ''}
          />
          <PostingSummary
            contentType={form.content_type}
            mediaType={media.asset_type}
            hasMedia={Boolean(mediaUrl && !mediaUrlError)}
            schedules={schedules}
            tags={parsedTags}
          />
        </aside>
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

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  )
}

function SectionHeader({ title, eyebrow, compact = false }: { title: string; eyebrow: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'mb-5'}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">{eyebrow}</p>
      <h3 className="mt-1 text-base font-semibold text-slate-950">{title}</h3>
    </div>
  )
}

function PostPreview({
  caption,
  contentType,
  media,
  mediaUrl,
  platform,
  schedule,
}: {
  caption: string
  contentType: ContentType
  media: MediaForm
  mediaUrl: string
  platform: Platform
  schedule: string
}) {
  const isVertical = contentType === 'story' || contentType === 'reel' || media.asset_type === 'story' || media.asset_type === 'reel'
  const isInstagram = platform === 'ig'
  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label ?? 'Facebook'
  const captionText = caption.trim() || 'ข้อความตัวอย่างสำหรับโพสต์ของ OnlinGo'
  const scheduleText = schedule
    ? new Date(schedule).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : 'ยังไม่กำหนดเวลา'

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader title="Post Preview" eyebrow="Live" compact />
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{platformLabel}</span>
      </div>

      <div className={isInstagram ? 'post-preview-card post-preview-instagram' : 'post-preview-card'}>
        <div className="post-preview-header">
          <div className="post-preview-avatar">O</div>
          <div>
            <p className="text-sm font-semibold text-slate-950">OnlinGo</p>
            <p className="text-xs text-[var(--muted)]">{scheduleText}</p>
          </div>
        </div>

        {isInstagram && mediaUrl ? (
          <MediaFrame url={mediaUrl} assetType={media.asset_type} contentType={contentType} vertical={isVertical} />
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{captionText}</p>

        {!isInstagram && mediaUrl ? (
          <MediaFrame url={mediaUrl} assetType={media.asset_type} contentType={contentType} vertical={isVertical} />
        ) : null}

        {!mediaUrl && (
          <div className={isVertical ? 'post-preview-empty post-preview-empty-vertical' : 'post-preview-empty'}>
            <span>{CONTENT_TYPE_LABELS[contentType]}</span>
          </div>
        )}

        <div className="post-preview-actions">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
      </div>
    </section>
  )
}

function PostingSummary({
  contentType,
  mediaType,
  hasMedia,
  schedules,
  tags,
}: {
  contentType: ContentType
  mediaType: CreateAssetType
  hasMedia: boolean
  schedules: ScheduleRow[]
  tags: string[]
}) {
  const autoCount = schedules.filter((schedule) => schedule.post_mode === 'auto').length
  const manualCount = schedules.length - autoCount

  return (
    <section className="surface-card p-5">
      <SectionHeader title="Posting Summary" eyebrow="Ready" />
      <div className="flex flex-col gap-3 text-sm">
        <SummaryRow label="ประเภท" value={CONTENT_TYPE_LABELS[contentType]} />
        <SummaryRow label="Media" value={hasMedia ? mediaTypeLabel(mediaType) : 'ไม่มี'} />
        <SummaryRow label="กำหนดการ" value={`${schedules.length} แถว`} />
        <SummaryRow label="Auto / Manual" value={`${autoCount} / ${manualCount}`} />
        <SummaryRow label="Tags" value={tags.length > 0 ? `${tags.length} tags` : 'ไม่มี'} />
      </div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}

function MediaFrame({
  url,
  assetType,
  contentType,
  compact = false,
  vertical = false,
}: {
  url: string
  assetType: CreateAssetType
  contentType: ContentType
  compact?: boolean
  vertical?: boolean
}) {
  const shouldUseVideo = assetType === 'video' || assetType === 'reel' || (!isLikelyImageUrl(url) && (assetType === 'story' || contentType === 'story'))
  const isVerticalFrame = vertical || contentType === 'story' || contentType === 'reel' || assetType === 'story' || assetType === 'reel'
  const frameClass = [
    compact ? 'media-thumb-frame' : 'post-preview-media',
    isVerticalFrame ? 'post-preview-media-vertical' : '',
    contentType === 'story' || assetType === 'story' ? 'post-preview-media-story' : '',
  ].filter(Boolean).join(' ')

  if (shouldUseVideo) {
    return (
      <div className={frameClass}>
        <video src={url} muted playsInline controls={compact} />
      </div>
    )
  }

  return (
    <div className={frameClass} style={{ backgroundImage: `url(${url})` }} />
  )
}

function parseTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyImageUrl(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase()
    return /\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)
  } catch {
    return false
  }
}

function createAssetName(title: string, url: string) {
  const cleanTitle = title.trim()
  if (cleanTitle) return cleanTitle
  try {
    const pathname = new URL(url).pathname
    const name = pathname.split('/').filter(Boolean).pop()
    return name || 'CMP media asset'
  } catch {
    return 'CMP media asset'
  }
}

function mediaTypeLabel(type: CreateAssetType) {
  return MEDIA_TYPES.find((item) => item.value === type)?.label ?? type
}
