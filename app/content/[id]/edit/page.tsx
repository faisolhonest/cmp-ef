'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type {
  Asset,
  AssetType,
  Campaign,
  ContentItemWithRelations,
  ContentType,
  Platform,
  PostMode,
  Schedule,
  ScheduleStatus,
} from '@/lib/types'
import { getPublishingStatus, getSchedulePublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import AlbumPreviewGrid from '@/components/AlbumPreviewGrid'

type CreateAssetType = Extract<AssetType, 'image' | 'video' | 'reel' | 'story'>
type MediaMode = 'text' | CreateAssetType | 'album'

type EditForm = {
  title: string
  caption_main: string
  tags: string
  campaign_id: string
  internal_notes: string
}

type ScheduleEditRow = {
  id: string
  isNew: boolean
  status: ScheduleStatus
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'Other' },
]

const AUTO_PLATFORMS: Platform[] = ['fb', 'ig']
const EDITABLE_ASSET_TYPES: CreateAssetType[] = ['image', 'video', 'reel', 'story']
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
  video: 'Video',
  live_teaser: 'Live Teaser',
}

export default function ContentEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<ContentItemWithRelations | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({
    title: '',
    caption_main: '',
    tags: '',
    campaign_id: '',
    internal_notes: '',
  })
  const [mediaType, setMediaType] = useState<MediaMode>('text')
  const [singleMediaUrl, setSingleMediaUrl] = useState('')
  const [albumUrls, setAlbumUrls] = useState<string[]>([])
  const [editSchedules, setEditSchedules] = useState<ScheduleEditRow[]>([])

  const loadContent = useCallback(async () => {
    setLoading(true)
    const [{ data: content }, { data: schedData }, { data: campaignData }] = await Promise.all([
      supabase.from('cmp_content_items').select('*, campaign:cmp_campaigns(*)').eq('id', id).single(),
      supabase.from('cmp_schedules').select('*').eq('content_item_id', id).order('scheduled_at'),
      supabase.from('cmp_campaigns').select('*').eq('status', 'active').order('name'),
    ])

    if (!content) {
      router.push('/content')
      return
    }

    const contentItem = content as ContentItemWithRelations
    const scheduleRows = (schedData ?? []) as Schedule[]
    const orderedAssets = await loadAssetsInOrder(contentItem)
    const initialMediaType = mediaModeFromContent(contentItem, orderedAssets)

    setItem(contentItem)
    setAssets(orderedAssets)
    setSchedules(scheduleRows)
    setCampaigns((campaignData ?? []) as Campaign[])
    setForm({
      title: contentItem.title,
      caption_main: contentItem.caption_main ?? '',
      tags: (contentItem.tags ?? []).join(', '),
      campaign_id: contentItem.campaign_id ?? '',
      internal_notes: scheduleRows.find((schedule) => schedule.notes)?.notes ?? orderedAssets[0]?.notes ?? '',
    })
    setMediaType(initialMediaType)
    setSingleMediaUrl(isSingleAssetMedia(initialMediaType) ? orderedAssets[0]?.url ?? '' : '')
    setAlbumUrls(initialMediaType === 'album' ? ensureAlbumRows(orderedAssets.map((asset) => asset.url)) : [])
    setEditSchedules(scheduleRows.map(toEditableSchedule))
    setError('')
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  const isAlbum = mediaType === 'album'
  const isSingleMedia = isSingleAssetMedia(mediaType)
  const mediaUrl = singleMediaUrl.trim()
  const albumInputUrls = albumUrls.map((url) => url.trim()).filter(Boolean)
  const albumPreviewUrls = albumInputUrls.filter(isHttpsUrl)
  const parsedTags = parseTags(form.tags)
  const selectedContentType = contentTypeForMedia(mediaType)
  const publishingStatus = item ? getPublishingStatus(editSchedules, item.status) : 'draft'
  const isPublished = publishingStatus === 'published'
  const isArchived = publishingStatus === 'archived'
  const canEditContent = !isPublished && !isArchived
  const canArchiveContent = !isArchived
  const archiveActionLabel = isPublished ? 'Archive content' : 'Delete content'
  const archiveActionDescription = isPublished
    ? 'Published content cannot be deleted. Archive keeps database rows intact.'
    : 'Before publishing this uses safe soft delete: status will be set to archived.'
  const previewPlatform = editSchedules[0]?.platform ?? 'fb'
  const previewSchedule = editSchedules[0]?.scheduled_at ?? ''

  function updateMediaType(nextMediaType: MediaMode) {
    if (nextMediaType === mediaType) return
    setMediaType(nextMediaType)
    setSingleMediaUrl('')
    setAlbumUrls(nextMediaType === 'album' ? ['', ''] : [])
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

  function addSchedule() {
    setEditSchedules((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        isNew: true,
        status: 'pending',
        platform: 'fb',
        scheduled_at: '',
        post_mode: 'auto',
      },
    ])
  }

  function removeSchedule(rowId: string) {
    setEditSchedules((prev) => prev.filter((schedule) => schedule.id !== rowId))
  }

  function updateSchedule(rowId: string, patch: Partial<ScheduleEditRow>) {
    setEditSchedules((prev) =>
      prev.map((schedule) => {
        if (schedule.id !== rowId) return schedule
        const updated = { ...schedule, ...patch }
        if (patch.platform) {
          updated.post_mode = AUTO_PLATFORMS.includes(patch.platform) ? 'auto' : 'manual'
        }
        return updated
      })
    )
  }

  async function saveEdit() {
    if (!item) return
    if (!canEditContent) {
      setError('เผยแพร่แล้วหรือเก็บถาวรแล้ว แก้ไขได้เฉพาะการ Archive เท่านั้น')
      return
    }
    if (!form.title.trim()) {
      setError('กรุณาใส่ชื่อคอนเทนต์')
      return
    }
    if (isSingleMedia && !mediaUrl) {
      setError('กรุณาใส่ Public HTTPS media URL หรือเลือก Text')
      return
    }
    if (isSingleMedia && !isHttpsUrl(mediaUrl)) {
      setError('Media URL ต้องเป็น public HTTPS URL')
      return
    }

    const albumValidation = isAlbum ? validateAlbumUrls(albumUrls) : { urls: [], error: '' }
    if (albumValidation.error) {
      setError(albumValidation.error)
      return
    }

    const scheduleValidation = validateScheduleRows(editSchedules)
    if (scheduleValidation) {
      setError(scheduleValidation)
      return
    }

    setSaving(true)
    setError('')

    const createdAssetIds: string[] = []
    let contentUpdated = false

    try {
      const now = new Date().toISOString()
      const nextAssetIds = await prepareAssetIds(albumValidation.urls, createdAssetIds)

      const { error: contentErr } = await supabase
        .from('cmp_content_items')
        .update({
          title: form.title.trim(),
          content_type: selectedContentType,
          caption_main: form.caption_main.trim() || null,
          asset_ids: nextAssetIds,
          tags: parsedTags.length > 0 ? parsedTags : null,
          campaign_id: form.campaign_id || null,
          updated_at: now,
        })
        .eq('id', id)
      if (contentErr) throw contentErr
      contentUpdated = true

      await syncSchedules(now)
      await cleanupReplacedAssets(item.asset_ids ?? [], nextAssetIds ?? [])

      setToast('บันทึกการแก้ไขเรียบร้อย')
      setTimeout(() => router.push(`/content/${id}`), 600)
    } catch (err) {
      if (!contentUpdated && createdAssetIds.length > 0) {
        await supabase.from('cmp_assets').delete().in('id', createdAssetIds)
      }
      setError(err instanceof Error ? err.message : 'บันทึกการแก้ไขไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function prepareAssetIds(validAlbumUrls: string[], createdAssetIds: string[]) {
    if (mediaType === 'text') return null

    if (isSingleAssetMedia(mediaType)) {
      const assetPayload = {
        name: createAssetName(form.title, mediaUrl),
        asset_type: mediaType,
        url: mediaUrl,
        thumbnail_url: mediaType === 'image' || (mediaType === 'story' && isLikelyImageUrl(mediaUrl)) ? mediaUrl : null,
        tags: parsedTags.length > 0 ? parsedTags : null,
        notes: form.internal_notes.trim() || null,
      }
      const existingSingleAsset = assets.length === 1 ? assets[0] : null

      if (existingSingleAsset && existingSingleAsset.url === mediaUrl && existingSingleAsset.asset_type === mediaType) {
        const { data, error: updateErr } = await supabase
          .from('cmp_assets')
          .update(assetPayload)
          .eq('id', existingSingleAsset.id)
          .select('id')
          .single()
        if (updateErr || !data) throw updateErr ?? new Error('อัปเดต asset ไม่สำเร็จ')
        return [data.id]
      }

      const { data, error: insertErr } = await supabase
        .from('cmp_assets')
        .insert(assetPayload)
        .select('id')
        .single()
      if (insertErr || !data) throw insertErr ?? new Error('สร้าง asset ไม่สำเร็จ')
      createdAssetIds.push(data.id)
      return [data.id]
    }

    const nextAssetIds: string[] = []
    for (let index = 0; index < validAlbumUrls.length; index += 1) {
      const url = validAlbumUrls[index]
      const { data, error: insertErr } = await supabase
        .from('cmp_assets')
        .insert({
          name: createAlbumAssetName(form.title, index),
          asset_type: 'image' as const,
          url,
          thumbnail_url: url,
          tags: parsedTags.length > 0 ? parsedTags : null,
          notes: form.internal_notes.trim() || null,
        })
        .select('id')
        .single()
      if (insertErr || !data) throw insertErr ?? new Error('สร้าง Album asset ไม่สำเร็จ')
      nextAssetIds.push(data.id)
      createdAssetIds.push(data.id)
    }
    return nextAssetIds
  }

  async function syncSchedules(now: string) {
    const keptExistingIds = new Set(editSchedules.filter((schedule) => !schedule.isNew).map((schedule) => schedule.id))
    const deletedIds = schedules.map((schedule) => schedule.id).filter((scheduleId) => !keptExistingIds.has(scheduleId))

    for (const schedule of editSchedules.filter((row) => !row.isNew)) {
      const { error: updateErr } = await supabase
        .from('cmp_schedules')
        .update({
          platform: schedule.platform,
          scheduled_at: new Date(schedule.scheduled_at).toISOString(),
          post_mode: schedule.post_mode,
          notes: form.internal_notes.trim() || null,
          updated_at: now,
        })
        .eq('id', schedule.id)
        .eq('content_item_id', id)
      if (updateErr) throw updateErr
    }

    const newSchedules = editSchedules.filter((schedule) => schedule.isNew)
    if (newSchedules.length > 0) {
      const { error: insertErr } = await supabase.from('cmp_schedules').insert(
        newSchedules.map((schedule) => ({
          content_item_id: id,
          platform: schedule.platform,
          scheduled_at: new Date(schedule.scheduled_at).toISOString(),
          post_mode: schedule.post_mode,
          status: 'pending' as const,
          notes: form.internal_notes.trim() || null,
        }))
      )
      if (insertErr) throw insertErr
    }

    if (deletedIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('cmp_schedules')
        .delete()
        .eq('content_item_id', id)
        .in('id', deletedIds)
      if (deleteErr) throw deleteErr
    }
  }

  async function cleanupReplacedAssets(previousAssetIds: string[], nextAssetIds: string[]) {
    const nextIdSet = new Set(nextAssetIds)
    const candidateAssetIds = previousAssetIds.filter((assetId) => !nextIdSet.has(assetId))
    if (candidateAssetIds.length === 0) return

    const { data: otherContent, error: lookupErr } = await supabase
      .from('cmp_content_items')
      .select('id, asset_ids')
      .neq('id', id)
    if (lookupErr) throw lookupErr

    const referencedElsewhere = new Set<string>()
    for (const content of otherContent ?? []) {
      const assetIds = Array.isArray((content as { asset_ids?: unknown }).asset_ids)
        ? (content as { asset_ids: string[] }).asset_ids
        : []
      for (const assetId of assetIds) {
        if (candidateAssetIds.includes(assetId)) referencedElsewhere.add(assetId)
      }
    }

    const unusedAssetIds = candidateAssetIds.filter((assetId) => !referencedElsewhere.has(assetId))
    if (unusedAssetIds.length === 0) return

    const { error: deleteErr } = await supabase.from('cmp_assets').delete().in('id', unusedAssetIds)
    if (deleteErr) throw deleteErr
  }

  async function archiveContent() {
    if (!item) return
    if (!window.confirm(`${archiveActionLabel}? This sets status to archived without deleting database rows.`)) return

    setArchiving(true)
    setError('')
    const { error: archiveErr } = await supabase
      .from('cmp_content_items')
      .update({ status: 'archived' as const, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (archiveErr) {
      setError(archiveErr.message)
      setArchiving(false)
      return
    }

    setToast('เก็บคอนเทนต์เข้าคลังถาวรแล้ว')
    setTimeout(() => router.push('/content'), 700)
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

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
            <Link href={`/content/${id}`} className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]">
              ← กลับไปหน้า detail
            </Link>
            <h2 className="mt-3 text-[1.6rem] font-semibold leading-tight text-slate-950">Edit Content</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.title}</p>
          </div>
          <div className="input-shell flex w-fit items-center gap-2 px-3 py-2">
            <StatusBadge status={publishingStatus} />
          </div>
        </div>
      </section>

      <div className="detail-edit-layout">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="ข้อมูลคอนเทนต์">
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <div className="rounded-[14px] border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Publishing status</span>
                <StatusBadge status={publishingStatus} />
              </div>
              {isPublished && <p className="mt-2 text-xs text-[var(--muted)]">เผยแพร่แล้ว: core content และ schedules ถูกล็อก แก้ได้เฉพาะ Archive</p>}
              {isArchived && <p className="mt-2 text-xs text-[var(--muted)]">เก็บถาวรแล้ว: ไม่สามารถแก้ไขคอนเทนต์นี้ได้</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <EditField label="ชื่อคอนเทนต์">
                <input
                  type="text"
                  value={form.title}
                  disabled={!canEditContent}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="input-shell w-full px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                />
              </EditField>
              <EditField label="แคมเปญ">
                <select
                  value={form.campaign_id}
                  disabled={!canEditContent}
                  onChange={(event) => setForm({ ...form, campaign_id: event.target.value })}
                  className="input-shell w-full px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                >
                  <option value="">ไม่ระบุแคมเปญ</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </EditField>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <EditField label="Tags">
                <input
                  type="text"
                  value={form.tags}
                  disabled={!canEditContent}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="คั่นด้วยจุลภาค"
                  className="input-shell w-full px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                />
              </EditField>
            </div>

            <EditField label="Caption">
              <textarea
                value={form.caption_main}
                disabled={!canEditContent}
                onChange={(event) => setForm({ ...form, caption_main: event.target.value })}
                rows={5}
                className="input-shell w-full resize-none px-3.5 py-2.5 text-sm leading-6 outline-none disabled:opacity-60"
              />
            </EditField>

            <EditField label="Internal notes">
              <textarea
                value={form.internal_notes}
                disabled={!canEditContent}
                onChange={(event) => setForm({ ...form, internal_notes: event.target.value })}
                rows={3}
                placeholder="บันทึกภายในทีม"
                className="input-shell w-full resize-none px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
              />
            </EditField>
          </Card>

          <Card title="Media / Assets">
            <EditField label="ประเภทสื่อ">
              <div className="segmented-control w-fit max-w-full flex-wrap">
                {MEDIA_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    disabled={!canEditContent}
                    data-active={mediaType === type.value}
                    onClick={() => updateMediaType(type.value)}
                    className="segmented-option text-sm disabled:opacity-60"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </EditField>

            {mediaType === 'text' && (
              <div className="surface-muted px-4 py-4 text-sm text-[var(--muted)]">
                Text content will save without cmp_assets and asset_ids will be null.
              </div>
            )}

            {isSingleMedia && (
              <EditField label="Public HTTPS media URL">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    value={singleMediaUrl}
                    disabled={!canEditContent}
                    onChange={(event) => setSingleMediaUrl(event.target.value)}
                    placeholder="https://example.com/media.jpg"
                    className="input-shell min-w-0 flex-1 px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                  />
                  {singleMediaUrl && (
                    <button type="button" onClick={() => setSingleMediaUrl('')} disabled={!canEditContent} className="secondary-button px-4 py-2 text-sm disabled:opacity-50">
                      ลบสื่อ
                    </button>
                  )}
                </div>
                {mediaUrl && !isHttpsUrl(mediaUrl) && (
                  <p className="mt-2 text-xs font-medium text-red-600">Media URL ต้องเป็น public HTTPS URL</p>
                )}
                {mediaUrl && isHttpsUrl(mediaUrl) && (
                  <div className="asset-preview-row mt-3">
                    <MediaFrame url={mediaUrl} assetType={mediaType} contentType={selectedContentType} compact />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">{mediaTypeLabel(mediaType)}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{mediaUrl}</p>
                    </div>
                  </div>
                )}
              </EditField>
            )}

            {isAlbum && (
              <EditField label="Public HTTPS image URLs">
                <div className="flex flex-col gap-3">
                  {albumUrls.map((url, index) => (
                    <div key={index} className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="url"
                        value={url}
                        disabled={!canEditContent}
                        onChange={(event) => updateAlbumUrl(index, event.target.value)}
                        placeholder={`https://example.com/image-${index + 1}.jpg`}
                        className="input-shell min-w-0 flex-1 px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => removeAlbumUrl(index)}
                        disabled={!canEditContent || albumUrls.length <= ALBUM_MIN_IMAGES}
                        className="secondary-button px-4 py-2 text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-[var(--muted)]">{ALBUM_HELPER_TEXT}</p>
                    <button type="button" onClick={addAlbumUrl} disabled={!canEditContent} className="secondary-button w-fit px-4 py-2 text-sm font-medium text-[var(--brand)] disabled:opacity-50">
                      + Add image
                    </button>
                  </div>
                </div>
              </EditField>
            )}
          </Card>

          <Card title={`Schedules / Platforms (${editSchedules.length})`}>
            <div className="flex justify-end">
              <button type="button" onClick={addSchedule} disabled={!canEditContent} className="secondary-button w-fit px-4 py-2 text-sm font-medium text-[var(--brand)] disabled:opacity-50">
                + Add platform
              </button>
            </div>

            {editSchedules.length === 0 ? (
              <div className="surface-muted px-4 py-5 text-sm text-[var(--muted)]">
                ยังไม่มี schedule
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {editSchedules.map((schedule) => (
                  <div key={schedule.id} className="surface-muted p-4">
                    <div className="edit-schedule-row-grid">
                      <MiniField label="Platform">
                        <select
                          value={schedule.platform}
                          disabled={!canEditContent}
                          onChange={(event) => updateSchedule(schedule.id, { platform: event.target.value as Platform })}
                          className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                        >
                          {PLATFORMS.map((platform) => (
                            <option key={platform.value} value={platform.value}>{platform.label}</option>
                          ))}
                        </select>
                      </MiniField>
                      <MiniField label="Scheduled time">
                        <input
                          type="datetime-local"
                          value={schedule.scheduled_at}
                          disabled={!canEditContent}
                          onChange={(event) => updateSchedule(schedule.id, { scheduled_at: event.target.value })}
                          className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                        />
                      </MiniField>
                      <MiniField label="Post mode">
                        <select
                          value={schedule.post_mode}
                          disabled={!canEditContent}
                          onChange={(event) => updateSchedule(schedule.id, { post_mode: event.target.value as PostMode })}
                          className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                        >
                          <option value="auto">Auto</option>
                          <option value="manual">Manual</option>
                        </select>
                      </MiniField>
                      <MiniField label="Status">
                        <div className="flex min-h-[38px] items-center">
                          <StatusBadge status={getSchedulePublishingStatus(schedule.status)} />
                        </div>
                      </MiniField>
                      <div className="edit-schedule-remove-cell">
                        <button type="button" onClick={() => removeSchedule(schedule.id)} disabled={!canEditContent} className="secondary-button w-full px-3 py-2 text-sm disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {canArchiveContent && (
            <div className="flex flex-col gap-3 rounded-[18px] border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-900">{archiveActionLabel}</p>
                <p className="mt-1 text-xs text-red-700">{archiveActionDescription}</p>
              </div>
              <button type="button" onClick={archiveContent} disabled={saving || archiving} className="secondary-button px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                {archiving ? 'Archiving...' : archiveActionLabel}
              </button>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link href={`/content/${id}`} className="secondary-button px-5 py-3 text-center text-sm">
              ยกเลิก
            </Link>
            <button type="button" onClick={saveEdit} disabled={!canEditContent || saving || archiving} className="primary-button px-6 py-3 text-sm font-semibold disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </div>

        <aside className="new-content-preview-column">
          <PostPreview
            caption={form.caption_main}
            contentType={selectedContentType}
            mediaType={mediaType}
            mediaUrl={isSingleMedia && isHttpsUrl(mediaUrl) ? mediaUrl : ''}
            albumUrls={isAlbum ? albumPreviewUrls : []}
            platform={previewPlatform}
            schedule={previewSchedule}
          />
          <PostingSummary
            contentType={selectedContentType}
            mediaType={mediaType}
            albumImageCount={isAlbum ? albumInputUrls.length : 0}
            schedules={editSchedules}
            tags={parsedTags}
            status={publishingStatus}
          />
        </aside>
      </div>
    </>
  )
}

async function loadAssetsInOrder(contentItem: ContentItemWithRelations) {
  const assetIds = Array.isArray(contentItem.asset_ids) ? contentItem.asset_ids : []
  if (assetIds.length === 0) return []

  const { data: assetData } = await supabase.from('cmp_assets').select('*').in('id', assetIds)
  const assetOrder = new Map(assetIds.map((assetId, index) => [assetId, index]))
  return ((assetData ?? []) as Asset[]).sort((a, b) => (assetOrder.get(a.id) ?? 0) - (assetOrder.get(b.id) ?? 0))
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5 md:p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-950">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
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

function PostPreview({
  caption,
  contentType,
  mediaType,
  mediaUrl,
  albumUrls,
  platform,
  schedule,
}: {
  caption: string
  contentType: ContentType
  mediaType: MediaMode
  mediaUrl: string
  albumUrls: string[]
  platform: Platform
  schedule: string
}) {
  const isAlbum = mediaType === 'album'
  const singleAssetType = isSingleAssetMedia(mediaType) ? mediaType : 'image'
  const isVertical = contentType === 'story' || contentType === 'reel' || mediaType === 'story' || mediaType === 'reel'
  const isInstagram = platform === 'ig'
  const platformLabel = PLATFORMS.find((item) => item.value === platform)?.label ?? 'Facebook'
  const captionText = caption.trim() || 'ข้อความตัวอย่างสำหรับโพสต์ของ OnlinGo'
  const scheduleText = schedule ? formatDateTime(schedule) : 'ยังไม่กำหนดเวลา'

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">Live</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">Post Preview</h3>
        </div>
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

        {isInstagram && mediaUrl && !isAlbum ? (
          <MediaFrame url={mediaUrl} assetType={singleAssetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{captionText}</p>

        {isAlbum && albumUrls.length > 0 ? (
          <>
            <AlbumPreviewGrid urls={albumUrls} />
            <p className="text-xs font-medium text-[var(--muted)]">{ALBUM_PREVIEW_NOTE}</p>
          </>
        ) : null}

        {!isInstagram && mediaUrl && !isAlbum ? (
          <MediaFrame url={mediaUrl} assetType={singleAssetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        {!mediaUrl && (!isAlbum || albumUrls.length === 0) && (
          <div className={isVertical ? 'post-preview-empty post-preview-empty-vertical' : 'post-preview-empty'}>
            <span>{mediaType === 'text' ? CONTENT_TYPE_LABELS[contentType] : mediaTypeLabel(mediaType)}</span>
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
  status,
}: {
  contentType: ContentType
  mediaType: MediaMode
  albumImageCount: number
  schedules: ScheduleEditRow[]
  tags: string[]
  status: ReturnType<typeof getPublishingStatus>
}) {
  const isAlbum = mediaType === 'album'
  const autoCount = schedules.filter((schedule) => schedule.post_mode === 'auto').length
  const manualCount = schedules.length - autoCount

  return (
    <section className="surface-card p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">Ready</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Posting Summary</h3>
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <SummaryRow label="ประเภท" value={CONTENT_TYPE_LABELS[contentType]} />
        <SummaryRow label="Media" value={mediaType === 'text' ? 'ไม่มี' : mediaTypeLabel(mediaType)} />
        {isAlbum && <SummaryRow label="จำนวนรูป" value={`${albumImageCount} รูป`} />}
        <SummaryRow label="Schedules" value={`${schedules.length} rows`} />
        <SummaryRow label="Auto / Manual" value={`${autoCount} / ${manualCount}`} />
        <SummaryRow label="Tags" value={tags.length > 0 ? `${tags.length} tags` : 'ไม่มี'} />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
          <span className="text-[var(--muted)]">Status</span>
          <StatusBadge status={status} />
        </div>
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

  return <div className={frameClass} style={{ backgroundImage: `url(${url})` }} />
}

function mediaModeFromContent(item: ContentItemWithRelations, orderedAssets: Asset[]): MediaMode {
  const assetCount = Array.isArray(item.asset_ids) ? item.asset_ids.length : orderedAssets.length
  if (assetCount > 1) return 'album'
  if (item.content_type === 'reel' || item.content_type === 'story' || item.content_type === 'video') return item.content_type
  const primaryAsset = orderedAssets[0]
  if (!primaryAsset) return 'text'
  if (primaryAsset.asset_type === 'image' || primaryAsset.asset_type === 'video' || primaryAsset.asset_type === 'reel' || primaryAsset.asset_type === 'story') {
    return primaryAsset.asset_type
  }
  return 'text'
}

function toEditableSchedule(schedule: Schedule): ScheduleEditRow {
  return {
    id: schedule.id,
    isNew: false,
    status: schedule.status,
    platform: schedule.platform,
    scheduled_at: toDateTimeLocal(schedule.scheduled_at),
    post_mode: schedule.post_mode,
  }
}

function ensureAlbumRows(urls: string[]) {
  if (urls.length >= ALBUM_MIN_IMAGES) return urls
  return [...urls, ...Array.from({ length: ALBUM_MIN_IMAGES - urls.length }, () => '')]
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

function validateScheduleRows(rows: ScheduleEditRow[]) {
  const missingSchedule = rows.find((row) => !row.scheduled_at)
  return missingSchedule ? 'กรุณาใส่เวลาโพสต์ให้ครบทุก schedule หรือกด Remove แถวที่ไม่ต้องการ' : ''
}

function isSingleAssetMedia(value: MediaMode): value is CreateAssetType {
  return value === 'image' || value === 'video' || value === 'reel' || value === 'story'
}

function contentTypeForMedia(value: MediaMode): ContentType {
  if (value === 'reel' || value === 'story' || value === 'video') return value
  return 'post'
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateTime(value: string | null) {
  if (!value) return 'ยังไม่มี'
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
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
  if (type === 'text') return 'Text'
  return EDITABLE_ASSET_TYPES.includes(type as CreateAssetType)
    ? type.charAt(0).toUpperCase() + type.slice(1)
    : type
}
