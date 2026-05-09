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
  Schedule,
  ScheduleStatus,
} from '@/lib/types'
import { getPublishingStatus, getSchedulePublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'
import AlbumPreviewGrid from '@/components/AlbumPreviewGrid'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'other', label: 'Other' },
]

const EDITABLE_ASSET_TYPES: CreateAssetType[] = ['image', 'video', 'reel', 'story']
const ALBUM_PREVIEW_NOTE = 'ตัวอย่างใกล้เคียง Facebook จริง การแสดงผลอาจเปลี่ยนตามสัดส่วนรูปและแพลตฟอร์ม'

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: 'Text',
  reel: 'Reel',
  story: 'Story',
  video: 'Video',
  live_teaser: 'Live Teaser',
}

const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: 'กำหนดแล้ว',
  auto_posted: 'เผยแพร่แล้ว',
  manually_posted: 'เผยแพร่แล้ว',
  failed: 'โพสต์ไม่สำเร็จ',
  skipped: 'ลบแล้ว',
  incomplete: 'ข้อมูลไม่ครบ',
}

type CreateAssetType = Extract<AssetType, 'image' | 'video' | 'reel' | 'story'>

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<ContentItemWithRelations | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  const loadContent = useCallback(async () => {
    setLoading(true)
    const [{ data: content }, { data: schedData }] = await Promise.all([
      supabase.from('cmp_content_items').select('*, campaign:cmp_campaigns(*)').eq('id', id).single(),
      supabase.from('cmp_schedules').select('*').eq('content_item_id', id).order('scheduled_at'),
    ])

    if (!content) {
      router.push('/content')
      return
    }

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
      const scheduleIds = schedData.map((schedule) => schedule.id)
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

  if (loading) {
    return <div className="py-20 text-center text-[var(--muted)]">กำลังโหลด...</div>
  }
  if (!item) return null

  const analyticsById = Object.fromEntries(analytics.map((row) => [row.schedule_id, row]))
  const publishingStatus = getPublishingStatus(schedules)
  const visibleSchedules = schedules.filter((schedule) => schedule.status !== 'skipped')
  const displaySchedules = publishingStatus === 'skipped' ? schedules : visibleSchedules
  const canEditContent = publishingStatus !== 'published' && publishingStatus !== 'skipped'
  const primaryAsset = assets[0]
  const declaredAssetCount = Array.isArray(item.asset_ids) ? item.asset_ids.length : assets.length
  const hasMultipleAssets = declaredAssetCount > 1 || assets.length > 1
  const albumUrls = hasMultipleAssets ? assets.map((asset) => asset.url) : []
  const previewContentType = item.content_type
  const previewCaption = item.caption_main ?? ''
  const previewMediaUrl = hasMultipleAssets ? '' : primaryAsset?.url ?? ''
  const previewAssetType = getPreviewAssetType(item.content_type, primaryAsset)
  const previewPlatform = visibleSchedules[0]?.platform ?? schedules[0]?.platform ?? 'fb'
  const previewSchedule = visibleSchedules[0]?.scheduled_at ?? ''

  return (
    <>
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
            {canEditContent ? (
              <Link href={`/content/${id}/edit`} className="primary-button px-4 py-2.5 text-sm font-semibold">
                Edit Content
              </Link>
            ) : (
              <span className="rounded-full bg-slate-100 px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
                {publishingStatus === 'published' ? 'เผยแพร่แล้ว แก้ไขไม่ได้' : 'ลบแล้ว'}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Card title="ข้อมูลคอนเทนต์">
            <InfoRow label="ประเภท" value={hasMultipleAssets ? 'Album' : getDisplayContentType(item.content_type, primaryAsset)} />
            <InfoRow label="แคมเปญ" value={(item.campaign as any)?.name ?? 'ไม่ระบุ'} />
            <InfoRow label="Status">
              <StatusBadge status={publishingStatus} />
            </InfoRow>
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
            <InfoRow label="Created" value={formatDate(item.created_at)} />
            <InfoRow label="Updated" value={formatDateTime(item.updated_at)} />
          </Card>

          {assets.length > 0 && (
            <Card title="Media / Assets">
              {hasMultipleAssets && (
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
                  <span>Album</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[var(--muted)]">
                    {assets.length} images
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {assets.map((asset) => (
                  <AssetListRow key={asset.id} asset={asset} contentType={item.content_type} />
                ))}
              </div>
            </Card>
          )}

          <Card title={`กำหนดการโพสต์ (${displaySchedules.length})`}>
            {displaySchedules.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ยังไม่มี schedule</p>
            ) : (
              <div className="flex flex-col gap-3">
                {displaySchedules.map((schedule) => {
                  const analyticsRow = analyticsById[schedule.id]
                  const scheduleStatus = getSchedulePublishingStatus(schedule.status)
                  return (
                    <div key={schedule.id} className="surface-muted p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={schedule.platform} showLabel />
                          <span className="text-sm text-[var(--muted)]">{formatDateTime(schedule.scheduled_at)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">
                            {schedule.post_mode === 'auto' ? 'โพสต์อัตโนมัติ' : 'โพสต์เอง'}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                            {SCHEDULE_STATUS_LABELS[schedule.status]}
                          </span>
                          <StatusBadge status={scheduleStatus} />
                        </div>
                      </div>
                      {analyticsRow && (
                        <div className="mt-3 grid gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-4">
                          <Metric label="Reach" value={analyticsRow.reach} />
                          <Metric label="Likes" value={analyticsRow.likes} />
                          <Metric label="Comments" value={analyticsRow.comments} />
                          <Metric label="Shares" value={analyticsRow.shares} />
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
          <DetailPostPreview
            caption={previewCaption}
            contentType={previewContentType}
            mediaUrl={previewMediaUrl}
            albumUrls={albumUrls}
            assetType={previewAssetType}
            platform={previewPlatform}
            schedule={previewSchedule}
          />
          <Card title="รายละเอียดการโพสต์">
            {displaySchedules.length === 0 ? (
              <>
                <InfoRow label="Platform" value="ยังไม่มี schedule" />
                <InfoRow label="Status">
                  <StatusBadge status={publishingStatus} />
                </InfoRow>
                <InfoRow label="Last updated" value={formatDateTime(item.updated_at)} />
              </>
            ) : (
              displaySchedules.map((schedule) => (
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

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[12px] bg-white px-3 py-2 text-center">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value?.toLocaleString() ?? '—'}</p>
    </div>
  )
}

function AssetListRow({ asset, contentType }: { asset: Asset; contentType: ContentType }) {
  const assetType = toEditableAssetType(asset.asset_type)

  return (
    <div className="asset-preview-row">
      <MediaFrame url={asset.url} assetType={assetType} contentType={contentType} compact />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{mediaTypeLabel(assetType)}</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">{asset.name}</p>
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
  albumUrls,
  assetType,
  platform,
  schedule,
}: {
  caption: string
  contentType: ContentType
  mediaUrl: string
  albumUrls: string[]
  assetType: CreateAssetType
  platform: Platform
  schedule: string
}) {
  const isAlbum = albumUrls.length > 0
  const isVertical = contentType === 'story' || contentType === 'reel' || assetType === 'story' || assetType === 'reel'
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
          <MediaFrame url={mediaUrl} assetType={assetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{captionText}</p>

        {isAlbum ? (
          <>
            <AlbumPreviewGrid urls={albumUrls} />
            <p className="text-xs font-medium text-[var(--muted)]">{ALBUM_PREVIEW_NOTE}</p>
          </>
        ) : null}

        {!isInstagram && mediaUrl && !isAlbum ? (
          <MediaFrame url={mediaUrl} assetType={assetType} contentType={contentType} vertical={isVertical} />
        ) : null}

        {!mediaUrl && !isAlbum && (
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

  return <div className={frameClass} style={{ backgroundImage: `url(${url})` }} />
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'long' })
}

function formatDateTime(value: string | null) {
  if (!value) return 'ยังไม่มี'
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function isLikelyImageUrl(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase()
    return /\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)
  } catch {
    return false
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
  return type.charAt(0).toUpperCase() + type.slice(1)
}
