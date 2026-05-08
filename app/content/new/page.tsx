'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AssetType, Campaign, ContentType, Platform, PostMode } from '@/lib/types'
import AlbumPreviewGrid from '@/components/AlbumPreviewGrid'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'อื่นๆ' },
]

const AUTO_PLATFORMS: Platform[] = ['fb', 'ig']
type CreateAssetType = Extract<AssetType, 'image' | 'video' | 'reel' | 'story'>
type MediaMode = 'text' | CreateAssetType | 'album'

const ALBUM_MIN_IMAGES = 2
const ALBUM_HELPER_TEXT = 'อัลบั้มต้องมีอย่างน้อย 2 รูป และใช้ URL รูปภาพแบบ https:// เท่านั้น'
const ALBUM_PREVIEW_NOTE = 'ตัวอย่างใกล้เคียง Facebook จริง การแสดงผลอาจเปลี่ยนตามสัดส่วนรูปและแพลตฟอร์ม'

const MEDIA_TYPES: { value: MediaMode; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'album', label: 'Album' },
]

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'Text',
  reel: 'Reel',
  story: 'Story',
  video: 'วิดีโอ',
  live_teaser: 'Live Teaser',
}

type ScheduleRow = {
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
}

type MediaForm = {
  asset_type: MediaMode
  url: string
}

export default function NewContentPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    caption_main: '',
    tags: '',
    campaign_id: '',
  })
  const [media, setMedia] = useState<MediaForm>({ asset_type: 'text', url: '' })
  const [albumUrls, setAlbumUrls] = useState<string[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])

  const isAlbum = media.asset_type === 'album'
  const isSingleMedia = isSingleAssetMedia(media.asset_type)
  const selectedContentType = contentTypeForMedia(media.asset_type)
  const mediaUrl = media.url.trim()
  const mediaUrlError = isSingleMedia && mediaUrl && !isHttpsUrl(mediaUrl) ? 'กรุณาใช้ URL แบบ https:// ที่เปิดสาธารณะได้' : ''
  const albumInputUrls = useMemo(() => albumUrls.map((url) => url.trim()).filter(Boolean), [albumUrls])
  const albumPreviewUrls = useMemo(() => albumInputUrls.filter(isHttpsUrl), [albumInputUrls])
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

  function updateMediaType(asset_type: MediaMode) {
    if (asset_type === media.asset_type) return
    setMedia({ asset_type, url: '' })
    setAlbumUrls(asset_type === 'album' ? ['', ''] : [])
    setError('')
  }

  function updateAlbumUrl(index: number, value: string) {
    setAlbumUrls((prev) => prev.map((url, i) => i === index ? value : url))
  }

  function addAlbumUrl() {
    setAlbumUrls((prev) => [...prev, ''])
  }

  function removeAlbumUrl(index: number) {
    setAlbumUrls((prev) => prev.length <= ALBUM_MIN_IMAGES ? prev : prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('กรุณาใส่ชื่อคอนเทนต์'); return }
    if (isSingleMedia && !mediaUrl) { setError('กรุณาใส่ Media URL หรือเลือก Text'); return }
    if (isSingleMedia && mediaUrlError) { setError(mediaUrlError); return }
    const albumValidation = isAlbum ? validateAlbumUrls(albumUrls) : { urls: [], error: '' }
    if (albumValidation.error) { setError(albumValidation.error); return }

    setSaving(true)
    setError('')

    let assetIds: string[] | null = null
    if (isAlbum) {
      const { data: assets, error: assetErr } = await supabase
        .from('cmp_assets')
        .insert(
          albumValidation.urls.map((url, index) => ({
            name: createAlbumAssetName(form.title, index),
            asset_type: 'image' as const,
            url,
            thumbnail_url: url,
            tags: parsedTags.length > 0 ? parsedTags : null,
          }))
        )
        .select('id')

      if (assetErr || !assets || assets.length !== albumValidation.urls.length) {
        setError(assetErr?.message ?? 'บันทึก Album media ไม่สำเร็จ')
        setSaving(false)
        return
      }

      assetIds = assets.map((asset) => asset.id)
    } else if (isSingleMedia) {
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
        content_type: selectedContentType,
        caption_main: form.caption_main.trim() || null,
        asset_ids: assetIds,
        tags: parsedTags.length > 0 ? parsedTags : null,
        campaign_id: form.campaign_id || null,
        status: 'draft',
      })
      .select()
      .single()

    if (itemErr || !item) {
      if (assetIds?.length) await cleanupCreatedRows(null, assetIds)
      setError(itemErr?.message ?? 'เกิดข้อผิดพลาด')
      setSaving(false)
      return
    }

    if (schedules.length > 0) {
      const validSchedules = schedules.filter((s) => s.scheduled_at)
      if (validSchedules.length > 0) {
        const { error: scheduleErr } = await supabase.from('cmp_schedules').insert(
          validSchedules.map((s) => ({
            content_item_id: item.id,
            platform: s.platform,
            scheduled_at: new Date(s.scheduled_at).toISOString(),
            post_mode: s.post_mode,
            status: 'pending' as const,
          }))
        )
        if (scheduleErr) {
          await cleanupCreatedRows(item.id, assetIds ?? [])
          setError(scheduleErr.message ?? 'บันทึก schedule ไม่สำเร็จ')
          setSaving(false)
          return
        }
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

              {isAlbum ? (
                <Field label="Public HTTPS image URLs">
                  <div className="flex flex-col gap-3">
                    {albumUrls.map((url, index) => (
                      <div key={index} className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateAlbumUrl(index, e.target.value)}
                          placeholder={`https://example.com/image-${index + 1}.jpg`}
                          className="input-shell min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeAlbumUrl(index)}
                          disabled={albumUrls.length <= ALBUM_MIN_IMAGES}
                          className="secondary-button px-4 py-2.5 text-sm disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-medium text-[var(--muted)]">{ALBUM_HELPER_TEXT}</p>
                      <button type="button" onClick={addAlbumUrl} className="secondary-button w-fit px-4 py-2 text-sm font-medium text-[var(--brand)]">
                        + Add image
                      </button>
                    </div>
                  </div>
                </Field>
              ) : isSingleMedia ? (
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
              ) : null}

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
            contentType={selectedContentType}
            media={media}
            mediaUrl={!isAlbum && mediaUrl && !mediaUrlError ? mediaUrl : ''}
            albumUrls={isAlbum ? albumPreviewUrls : []}
            platform={previewPlatform}
            schedule={primarySchedule?.scheduled_at ?? ''}
          />
          <PostingSummary
            contentType={selectedContentType}
            mediaType={media.asset_type}
            albumImageCount={isAlbum ? albumInputUrls.length : 0}
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
  albumUrls,
  platform,
  schedule,
}: {
  caption: string
  contentType: ContentType
  media: MediaForm
  mediaUrl: string
  albumUrls: string[]
  platform: Platform
  schedule: string
}) {
  const isAlbum = media.asset_type === 'album'
  const singleAssetType = isSingleAssetMedia(media.asset_type) ? media.asset_type : null
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

        {isInstagram && mediaUrl && singleAssetType ? (
          <MediaFrame url={mediaUrl} assetType={singleAssetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{captionText}</p>

        {isAlbum && albumUrls.length > 0 ? (
          <>
            <AlbumPreviewGrid urls={albumUrls} />
            <p className="text-xs font-medium text-[var(--muted)]">{ALBUM_PREVIEW_NOTE}</p>
          </>
        ) : null}

        {!isInstagram && mediaUrl && singleAssetType ? (
          <MediaFrame url={mediaUrl} assetType={singleAssetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        {!mediaUrl && (!isAlbum || albumUrls.length === 0) && (
          <div className={isVertical ? 'post-preview-empty post-preview-empty-vertical' : 'post-preview-empty'}>
            <span>{media.asset_type === 'text' ? CONTENT_TYPE_LABELS[contentType] : mediaTypeLabel(media.asset_type)}</span>
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
  albumImageCount,
  schedules,
  tags,
}: {
  contentType: ContentType
  mediaType: MediaMode
  albumImageCount: number
  schedules: ScheduleRow[]
  tags: string[]
}) {
  const isAlbum = mediaType === 'album'
  const autoCount = schedules.filter((schedule) => schedule.post_mode === 'auto').length
  const manualCount = schedules.length - autoCount

  return (
    <section className="surface-card p-5">
      <SectionHeader title="Posting Summary" eyebrow="Ready" />
      <div className="flex flex-col gap-3 text-sm">
        <SummaryRow label="ประเภท" value={CONTENT_TYPE_LABELS[contentType]} />
        <SummaryRow label="Media" value={mediaType === 'text' ? 'ไม่มี' : mediaTypeLabel(mediaType)} />
        <SummaryRow label="กำหนดการ" value={`${schedules.length} แถว`} />
        {isAlbum && <SummaryRow label="จำนวนรูป" value={`${albumImageCount} รูป`} />}
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

function validateAlbumUrls(urls: string[]) {
  const trimmedUrls = urls.map((url) => url.trim()).filter(Boolean)

  if (trimmedUrls.length < ALBUM_MIN_IMAGES) {
    return { urls: trimmedUrls, error: 'Album ต้องมีอย่างน้อย 2 รูป' }
  }

  if (trimmedUrls.some((url) => !isHttpsUrl(url))) {
    return { urls: trimmedUrls, error: 'Album image URL ต้องเป็น public HTTPS URL' }
  }

  return { urls: trimmedUrls, error: '' }
}

async function cleanupCreatedRows(contentItemId: string | null, assetIds: string[]) {
  if (contentItemId) {
    await supabase.from('cmp_content_items').delete().eq('id', contentItemId)
  }
  if (assetIds.length > 0) {
    await supabase.from('cmp_assets').delete().in('id', assetIds)
  }
}

function isSingleAssetMedia(value: MediaMode): value is CreateAssetType {
  return value === 'image' || value === 'video' || value === 'reel' || value === 'story'
}

function contentTypeForMedia(value: MediaMode): ContentType {
  if (value === 'reel' || value === 'story' || value === 'video') return value
  return 'post'
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

function createAlbumAssetName(title: string, index: number) {
  const cleanTitle = title.trim() || 'CMP album'
  return `${cleanTitle} - Image ${index + 1}`
}

function mediaTypeLabel(type: MediaMode) {
  if (type === 'album') return 'Album'
  return MEDIA_TYPES.find((item) => item.value === type)?.label ?? type
}
