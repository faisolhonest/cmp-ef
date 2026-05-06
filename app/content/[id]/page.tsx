'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type {
  Asset,
  AssetType,
  ContentItemWithRelations,
  ContentType,
  Platform,
  PostAnalytics,
  PostMode,
  Schedule,
  ScheduleStatus,
} from '@/lib/types'
import { getPublishingStatus, getSchedulePublishingStatus } from '@/lib/publishingStatus'
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
const EDITABLE_ASSET_TYPES: CreateAssetType[] = ['image', 'video', 'reel', 'story']
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

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; description: string }[] = [
  { value: 'post', label: 'Text', description: 'ข้อความ หรือ feed post พร้อมรูป' },
  { value: 'reel', label: 'Reel', description: 'วิดีโอแนวตั้ง 9:16' },
  { value: 'story', label: 'Story', description: 'Story 9:16 สำหรับ FB/IG' },
  { value: 'video', label: 'Video', description: 'วิดีโอ feed / long form' },
  { value: 'live_teaser', label: 'Live Teaser', description: 'คอนเทนต์โปรโมตไลฟ์' },
]

const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: 'กำหนดแล้ว',
  auto_posted: 'เผยแพร่แล้ว',
  manually_posted: 'เผยแพร่แล้ว',
  failed: 'โพสต์ไม่สำเร็จ',
  skipped: 'ข้ามแล้ว',
  incomplete: 'ข้อมูลไม่ครบ',
}

type CreateAssetType = Extract<AssetType, 'image' | 'video' | 'reel' | 'story'>

type EditForm = {
  title: string
  content_type: ContentType
  caption_main: string
  tags: string
  campaign_id: string
  media_url: string
  media_asset_type: CreateAssetType
  internal_notes: string
}

type ScheduleEditRow = {
  id: string
  status: ScheduleStatus
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<ContentItemWithRelations | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editError, setEditError] = useState('')
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    content_type: 'post',
    caption_main: '',
    tags: '',
    campaign_id: '',
    media_url: '',
    media_asset_type: 'image',
    internal_notes: '',
  })
  const [editSchedules, setEditSchedules] = useState<ScheduleEditRow[]>([])
  const [addingSchedule, setAddingSchedule] = useState(false)
  const [newSched, setNewSched] = useState<{ platform: Platform; scheduled_at: string; post_mode: PostMode }>({
    platform: 'fb',
    scheduled_at: '',
    post_mode: 'auto',
  })

  const loadContent = useCallback(async () => {
    setLoading(true)
    const [{ data: content }, { data: schedData }] = await Promise.all([
      supabase.from('cmp_content_items').select('*, campaign:cmp_campaigns(*)').eq('id', id).single(),
      supabase.from('cmp_schedules').select('*').eq('content_item_id', id).order('scheduled_at'),
    ])

    if (!content) { router.push('/content'); return }

    const contentItem = content as ContentItemWithRelations
    setItem(contentItem)
    setSchedules((schedData ?? []) as Schedule[])

    const assetIds = Array.isArray(contentItem.asset_ids) ? contentItem.asset_ids : []
    if (assetIds.length > 0) {
      const { data: assetData } = await supabase.from('cmp_assets').select('*').in('id', assetIds)
      const assetOrder = new Map(assetIds.map((assetId, index) => [assetId, index]))
      setAssets(
        ((assetData ?? []) as Asset[]).sort((a, b) => (assetOrder.get(a.id) ?? 0) - (assetOrder.get(b.id) ?? 0))
      )
    } else {
      setAssets([])
    }

    if (schedData && schedData.length > 0) {
      const scheduleIds = schedData.map((s) => s.id)
      const { data: analyticsData } = await supabase.from('cmp_post_analytics').select('*').in('schedule_id', scheduleIds)
      setAnalytics(analyticsData ?? [])
    } else {
      setAnalytics([])
    }

    setLoading(false)
  }, [id, router])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  useEffect(() => {
    supabase.from('cmp_campaigns').select('*').eq('status', 'active').order('name')
      .then(({ data }) => setCampaigns(data ?? []))
  }, [])

  function beginEdit() {
    if (!item) return
    const primaryAsset = assets[0]
    setEditForm({
      title: item.title,
      content_type: item.content_type,
      caption_main: item.caption_main ?? '',
      tags: (item.tags ?? []).join(', '),
      campaign_id: item.campaign_id ?? '',
      media_url: primaryAsset?.url ?? '',
      media_asset_type: toEditableAssetType(primaryAsset?.asset_type),
      internal_notes: schedules.find((schedule) => schedule.notes)?.notes ?? primaryAsset?.notes ?? '',
    })
    setEditSchedules(
      schedules.map((schedule) => ({
        id: schedule.id,
        status: schedule.status,
        platform: schedule.platform,
        scheduled_at: toDateTimeLocal(schedule.scheduled_at),
        post_mode: schedule.post_mode,
      }))
    )
    setEditError('')
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditError('')
  }

  function updateEditSchedule(scheduleId: string, patch: Partial<ScheduleEditRow>) {
    setEditSchedules((prev) =>
      prev.map((schedule) => {
        if (schedule.id !== scheduleId || schedule.status !== 'pending') return schedule
        const updated = { ...schedule, ...patch }
        if (patch.platform) {
          updated.post_mode = AUTO_PLATFORMS.includes(patch.platform) ? 'auto' : 'manual'
        }
        return updated
      })
    )
  }

  function updateEditContentType(content_type: ContentType) {
    setEditForm((prev) => ({
      ...prev,
      content_type,
      media_asset_type:
        content_type === 'reel' || content_type === 'story'
          ? content_type
          : content_type === 'video'
            ? 'video'
            : prev.media_asset_type,
    }))
  }

  async function saveEdit() {
    if (!item) return
    const canEditPublishing = canEditPublishingFields(schedules)
    const parsedTags = parseTags(editForm.tags)
    const mediaUrl = editForm.media_url.trim()

    if (!editForm.title.trim()) {
      setEditError('กรุณาใส่ชื่อคอนเทนต์')
      return
    }
    if (canEditPublishing && mediaUrl && !isHttpsUrl(mediaUrl)) {
      setEditError('Media URL ต้องเป็น public HTTPS URL')
      return
    }

    setSaving(true)
    setEditError('')

    try {
      const now = new Date().toISOString()
      let nextAssetIds = item.asset_ids ?? null

      if (canEditPublishing) {
        nextAssetIds = await syncPrimaryAsset(mediaUrl, parsedTags)
      } else if (assets[0]) {
        const { error } = await supabase
          .from('cmp_assets')
          .update({
            name: editForm.title.trim(),
            tags: parsedTags.length > 0 ? parsedTags : null,
            notes: editForm.internal_notes.trim() || null,
          })
          .eq('id', assets[0].id)
        if (error) throw error
      }

      const contentPatch: Record<string, any> = {
        title: editForm.title.trim(),
        tags: parsedTags.length > 0 ? parsedTags : null,
        campaign_id: editForm.campaign_id || null,
        updated_at: now,
      }

      if (canEditPublishing) {
        contentPatch.caption_main = editForm.caption_main.trim() || null
        contentPatch.asset_ids = nextAssetIds
        contentPatch.content_type = editForm.content_type
      }

      const { error: contentErr } = await supabase
        .from('cmp_content_items')
        .update(contentPatch)
        .eq('id', id)
      if (contentErr) throw contentErr

      if (schedules.length > 0) {
        const { error: notesErr } = await supabase
          .from('cmp_schedules')
          .update({ notes: editForm.internal_notes.trim() || null, updated_at: now })
          .eq('content_item_id', id)
        if (notesErr) throw notesErr
      }

      if (canEditPublishing) {
        for (const schedule of editSchedules) {
          if (schedule.status !== 'pending') continue
          if (!schedule.scheduled_at) throw new Error('กรุณาใส่เวลาโพสต์ของ schedule ที่ยัง pending')

          const { error: scheduleErr } = await supabase
            .from('cmp_schedules')
            .update({
              platform: schedule.platform,
              scheduled_at: new Date(schedule.scheduled_at).toISOString(),
              post_mode: schedule.post_mode,
              updated_at: now,
            })
            .eq('id', schedule.id)
            .eq('status', 'pending')

          if (scheduleErr) throw scheduleErr
        }
      }

      await loadContent()
      setEditMode(false)
      setToast('บันทึกการแก้ไขเรียบร้อย')
      setTimeout(() => setToast(null), 2500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'บันทึกการแก้ไขไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function syncPrimaryAsset(mediaUrl: string, parsedTags: string[]) {
    if (!mediaUrl) return null

    const payload = {
      name: createAssetName(editForm.title, mediaUrl),
      asset_type: editForm.media_asset_type,
      url: mediaUrl,
      thumbnail_url: editForm.media_asset_type === 'image' || (editForm.media_asset_type === 'story' && isLikelyImageUrl(mediaUrl)) ? mediaUrl : null,
      tags: parsedTags.length > 0 ? parsedTags : null,
      notes: editForm.internal_notes.trim() || null,
    }

    if (assets[0]) {
      const { data, error } = await supabase
        .from('cmp_assets')
        .update(payload)
        .eq('id', assets[0].id)
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('อัปเดต asset ไม่สำเร็จ')
      return [data.id]
    }

    const { data, error } = await supabase
      .from('cmp_assets')
      .insert(payload)
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('สร้าง asset ไม่สำเร็จ')
    return [data.id]
  }

  async function markAsPosted(scheduleId: string) {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('cmp_schedules')
      .update({ status: 'manually_posted', posted_at: now, updated_at: now })
      .eq('id', scheduleId)
      .select()
      .single()
    if (data) {
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? data as Schedule : s))
      setToast('บันทึกว่าโพสต์เรียบร้อยแล้ว')
      setTimeout(() => setToast(null), 2500)
    }
  }

  async function retrySchedule(scheduleId: string) {
    const { data } = await supabase
      .from('cmp_schedules')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .select()
      .single()
    if (data) {
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? data as Schedule : s))
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

  if (loading) {
    return <div className="py-20 text-center text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

  const analyticsById = Object.fromEntries(analytics.map((a) => [a.schedule_id, a]))
  const publishingStatus = getPublishingStatus(schedules)
  const allSchedulesPosted = schedules.length > 0 && schedules.every((schedule) => isPostedStatus(schedule.status))
  const canEditPublishing = canEditPublishingFields(schedules)
  const canAddSchedule = !allSchedulesPosted
  const primaryAsset = assets[0]
  const previewContentType = editMode ? editForm.content_type : item.content_type
  const previewCaption = editMode ? editForm.caption_main : item.caption_main ?? ''
  const previewMediaUrl = editMode ? editForm.media_url.trim() : primaryAsset?.url ?? ''
  const previewAssetType = editMode ? editForm.media_asset_type : getPreviewAssetType(item.content_type, primaryAsset)
  const previewPlatform = (editMode ? editSchedules[0]?.platform : schedules[0]?.platform) ?? 'fb'
  const previewSchedule = (editMode ? editSchedules[0]?.scheduled_at : schedules[0]?.scheduled_at) ?? ''

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="input-shell flex items-center gap-2 px-3 py-2">
              <StatusBadge status={publishingStatus} />
            </div>
            <button
              type="button"
              onClick={editMode ? cancelEdit : beginEdit}
              className={editMode ? 'secondary-button px-4 py-2.5 text-sm font-medium' : 'primary-button px-4 py-2.5 text-sm font-semibold'}
            >
              {editMode ? 'ยกเลิกแก้ไข' : 'Edit Content'}
            </button>
          </div>
        </div>
      </section>

      {editMode && (
        <div className="detail-edit-layout">
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="แก้ไขคอนเทนต์">
              <div className="rounded-[14px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {allSchedulesPosted
                  ? 'คอนเทนต์นี้เผยแพร่แล้ว แก้ได้เฉพาะ title, tags, campaign และ internal notes เท่านั้น เพราะ CMP ยังไม่รองรับการ edit post ผ่าน Meta API'
                  : canEditPublishing
                    ? 'มี schedule ที่ยัง pending จึงแก้ content type, caption, media และ schedule ที่ยังไม่โพสต์ได้'
                    : 'แก้ได้เฉพาะ metadata หากต้องแก้ schedule ให้ reset เป็น pending ก่อน'}
              </div>
              {editError && <p className="text-sm font-medium text-red-600">{editError}</p>}

              <div className="grid gap-4 md:grid-cols-2">
                <EditField label="ชื่อคอนเทนต์">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="input-shell w-full px-3.5 py-2.5 text-sm outline-none"
                  />
                </EditField>
                <EditField label="แคมเปญ">
                  <select
                    value={editForm.campaign_id}
                    onChange={(e) => setEditForm({ ...editForm, campaign_id: e.target.value })}
                    className="input-shell w-full px-3.5 py-2.5 text-sm outline-none"
                  >
                    <option value="">ไม่ระบุแคมเปญ</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                </EditField>
              </div>

              <EditField label="ประเภทคอนเทนต์">
                <div className="content-type-grid">
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEditPublishing}
                      aria-pressed={editForm.content_type === option.value}
                      data-active={editForm.content_type === option.value}
                      onClick={() => updateEditContentType(option.value)}
                      className="content-type-card disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{option.label}</span>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </EditField>

              {canEditPublishing && (
                <>
                  <EditField label="Caption">
                    <textarea
                      value={editForm.caption_main}
                      onChange={(e) => setEditForm({ ...editForm, caption_main: e.target.value })}
                      rows={5}
                      className="input-shell w-full resize-none px-3.5 py-2.5 text-sm leading-6 outline-none"
                    />
                  </EditField>

                  <div className="flex flex-col gap-4">
                    <p className="text-sm font-semibold text-slate-950">Media / Assets</p>
                    <div className="segmented-control w-fit max-w-full flex-wrap">
                      {MEDIA_TYPES.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          data-active={editForm.media_asset_type === type.value}
                          onClick={() => setEditForm({ ...editForm, media_asset_type: type.value })}
                          className="segmented-option text-sm"
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                    <EditField label="Public HTTPS media URL">
                      <input
                        type="url"
                        value={editForm.media_url}
                        onChange={(e) => setEditForm({ ...editForm, media_url: e.target.value })}
                        placeholder="https://example.com/media.jpg"
                        className="input-shell w-full px-3.5 py-2.5 text-sm outline-none"
                      />
                    </EditField>
                    {editForm.media_url.trim() && (
                      <div className="asset-preview-row">
                        <MediaFrame
                          url={editForm.media_url.trim()}
                          assetType={editForm.media_asset_type}
                          contentType={editForm.content_type}
                          compact
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-950">{mediaTypeLabel(editForm.media_asset_type)}</p>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">{editForm.media_url.trim()}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {editSchedules.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold text-slate-950">Schedules / Platforms</p>
                      {editSchedules.map((schedule) => {
                        const isEditable = schedule.status === 'pending'
                        return (
                          <div key={schedule.id} className="surface-muted p-4">
                            <div className="grid gap-3 lg:grid-cols-[150px_minmax(210px,1fr)_140px_120px]">
                              <EditField label="Platform">
                                <select
                                  value={schedule.platform}
                                  disabled={!isEditable}
                                  onChange={(e) => updateEditSchedule(schedule.id, { platform: e.target.value as Platform })}
                                  className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                                >
                                  {PLATFORMS.map((platform) => (
                                    <option key={platform.value} value={platform.value}>{platform.label}</option>
                                  ))}
                                </select>
                              </EditField>
                              <EditField label="Scheduled time">
                                <input
                                  type="datetime-local"
                                  value={schedule.scheduled_at}
                                  disabled={!isEditable}
                                  onChange={(e) => updateEditSchedule(schedule.id, { scheduled_at: e.target.value })}
                                  className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                                />
                              </EditField>
                              <EditField label="Post mode">
                                <select
                                  value={schedule.post_mode}
                                  disabled={!isEditable}
                                  onChange={(e) => updateEditSchedule(schedule.id, { post_mode: e.target.value as PostMode })}
                                  className="input-shell w-full px-3 py-2 text-sm outline-none disabled:opacity-60"
                                >
                                  <option value="auto">โพสต์อัตโนมัติ</option>
                                  <option value="manual">โพสต์เอง</option>
                                </select>
                              </EditField>
                              <div className="flex flex-col justify-end">
                                <span className="rounded-full bg-white px-2.5 py-2 text-center text-xs font-medium text-[var(--muted)]">
                                  {SCHEDULE_STATUS_LABELS[schedule.status]}
                                </span>
                              </div>
                            </div>
                            {!isEditable && (
                              <p className="mt-2 text-xs text-[var(--muted)]">schedule นี้เผยแพร่แล้ว จึงไม่แก้เวลา/platform/post mode จนกว่าจะมี API edit support</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              <EditField label="Tags">
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="คั่นด้วยจุลภาค"
                  className="input-shell w-full px-3.5 py-2.5 text-sm outline-none"
                />
              </EditField>

              <EditField label="Internal notes">
                <textarea
                  value={editForm.internal_notes}
                  onChange={(e) => setEditForm({ ...editForm, internal_notes: e.target.value })}
                  rows={3}
                  placeholder="บันทึกภายในทีม"
                  className="input-shell w-full resize-none px-3.5 py-2.5 text-sm outline-none"
                />
              </EditField>

              <div className="flex gap-3">
                <button type="button" onClick={saveEdit} disabled={saving} className="primary-button px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
                <button type="button" onClick={cancelEdit} className="secondary-button px-5 py-2.5 text-sm">
                  ยกเลิก
                </button>
              </div>
            </Card>
          </div>

          <aside className="new-content-preview-column">
            <DetailPostPreview
              caption={previewCaption}
              contentType={previewContentType}
              mediaUrl={previewMediaUrl}
              assetType={previewAssetType}
              platform={previewPlatform}
              schedule={previewSchedule}
            />
          </aside>
        </div>
      )}

      {!editMode && (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Card title="ข้อมูลคอนเทนต์">
            <InfoRow label="ประเภท" value={getDisplayContentType(item.content_type, primaryAsset)} />
            <InfoRow label="แคมเปญ" value={(item.campaign as any)?.name ?? 'ไม่ระบุ'} />
            <InfoRow label="Caption">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
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
            <InfoRow label="วันที่สร้าง" value={formatDate(item.created_at)} />
          </Card>

          {assets.length > 0 && (
            <Card title="Media / Assets">
              <div className="grid gap-3 md:grid-cols-2">
                {assets.map((asset) => (
                  <AssetPreviewCard key={asset.id} asset={asset} contentType={item.content_type} />
                ))}
              </div>
            </Card>
          )}

          <Card title={`กำหนดการโพสต์ (${schedules.length})`}>
            {schedules.length === 0 && !addingSchedule && (
              <p className="text-sm text-[var(--muted)]">ยังไม่มีกำหนดการโพสต์</p>
            )}
            {schedules.length > 0 && (
              <div className="flex flex-col gap-3">
                {schedules.map((s) => {
                  const a = analyticsById[s.id]
                  const scheduleStatus = getSchedulePublishingStatus(s.status)
                  return (
                    <div key={s.id} className="surface-muted p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={s.platform} showLabel />
                          <span className="text-sm text-[var(--muted)]">{formatDateTime(s.scheduled_at)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">{s.post_mode === 'auto' ? 'โพสต์อัตโนมัติ' : 'โพสต์เอง'}</span>
                          <StatusBadge status={scheduleStatus} />
                          {s.post_mode === 'manual' && s.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => markAsPosted(s.id)}
                              className="secondary-button px-3 py-1.5 text-xs font-medium"
                            >
                              Mark as Posted
                            </button>
                          )}
                          {s.status === 'failed' && (
                            <button
                              type="button"
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
            {canAddSchedule && (
              addingSchedule ? (
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
                    {newSched.post_mode === 'auto' ? 'โพสต์อัตโนมัติ' : 'โพสต์เอง'}
                  </span>
                  <div className="flex gap-2 lg:ml-auto">
                    <button type="button" onClick={saveNewSchedule} className="primary-button px-3 py-1.5 text-xs font-semibold">
                      บันทึก
                    </button>
                    <button type="button" onClick={() => setAddingSchedule(false)} className="secondary-button px-3 py-1.5 text-xs">
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
              )
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <DetailPostPreview
            caption={previewCaption}
            contentType={previewContentType}
            mediaUrl={previewMediaUrl}
            assetType={previewAssetType}
            platform={previewPlatform}
            schedule={previewSchedule}
          />
          <Card title="รายละเอียดการโพสต์">
            {schedules.length === 0 ? (
              <>
                <InfoRow label="Platform" value="ยังไม่มี schedule" />
                <InfoRow label="Status" value="ร่าง" />
                <InfoRow label="Last updated" value={formatDateTime(item.updated_at)} />
              </>
            ) : (
              schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-[14px] border border-[var(--line)] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <PlatformIcon platform={schedule.platform} showLabel />
                  </div>
                  <InfoRow label="Status">
                    <StatusBadge status={getSchedulePublishingStatus(schedule.status)} />
                  </InfoRow>
                  <InfoRow label="Scheduled" value={formatDateTime(schedule.scheduled_at)} />
                  {schedule.posted_at && <InfoRow label="Posted" value={formatDateTime(schedule.posted_at)} />}
                  {schedule.platform_post_id && <InfoRow label="Post ID" value={schedule.platform_post_id} />}
                  <InfoRow label="Last updated" value={formatDateTime(schedule.updated_at)} />
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
      )}
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
      <span className="w-28 flex-shrink-0 text-sm text-[var(--muted)]">{label}</span>
      {value !== undefined ? <span className="break-all text-sm text-slate-900">{value}</span> : children}
    </div>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
      {children}
    </label>
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

function AssetPreviewCard({ asset, contentType }: { asset: Asset; contentType: ContentType }) {
  const assetType = toEditableAssetType(asset.asset_type)

  return (
    <div className="asset-preview-row">
      <MediaFrame url={asset.url} assetType={assetType} contentType={contentType} compact />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">{mediaTypeLabel(assetType)}</p>
        <p className="mt-1 text-sm text-slate-900">{asset.name}</p>
        <a href={asset.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-medium text-[var(--brand)] hover:underline">
          {asset.url}
        </a>
      </div>
    </div>
  )
}

function DetailPostPreview({
  caption,
  contentType,
  mediaUrl,
  assetType,
  platform,
  schedule,
}: {
  caption: string
  contentType: ContentType
  mediaUrl: string
  assetType: CreateAssetType
  platform: Platform
  schedule: string
}) {
  const isVertical = contentType === 'story' || contentType === 'reel' || assetType === 'story' || assetType === 'reel'
  const isInstagram = platform === 'ig'
  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label ?? 'Facebook'
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

        {isInstagram && mediaUrl ? (
          <MediaFrame url={mediaUrl} assetType={assetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{captionText}</p>

        {!isInstagram && mediaUrl ? (
          <MediaFrame url={mediaUrl} assetType={assetType} contentType={contentType} vertical={isVertical} />
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

function canEditPublishingFields(schedules: Schedule[]) {
  return schedules.length === 0 || schedules.some((schedule) => schedule.status === 'pending')
}

function isPostedStatus(status: ScheduleStatus) {
  return status === 'auto_posted' || status === 'manually_posted'
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'long' })
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

function toEditableAssetType(value?: AssetType): CreateAssetType {
  return value && EDITABLE_ASSET_TYPES.includes(value as CreateAssetType) ? value as CreateAssetType : 'image'
}

function getPreviewAssetType(contentType: ContentType, asset?: Asset): CreateAssetType {
  if (asset) return toEditableAssetType(asset.asset_type)
  if (contentType === 'reel' || contentType === 'story') return contentType
  if (contentType === 'video') return 'video'
  return 'image'
}

function getDisplayContentType(contentType: ContentType, asset?: Asset) {
  if (contentType === 'post') {
    if (asset?.asset_type === 'image') return 'Image'
    if (asset?.asset_type === 'video') return 'Video'
    return 'Text'
  }
  if (contentType === 'reel') return 'Reel'
  if (contentType === 'story') return 'Story'
  if (contentType === 'video') return 'Video'
  return CONTENT_TYPE_LABELS[contentType]
}

function mediaTypeLabel(type: CreateAssetType) {
  return MEDIA_TYPES.find((item) => item.value === type)?.label ?? type
}
