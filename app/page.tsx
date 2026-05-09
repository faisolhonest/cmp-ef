'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Asset, AssetType, ContentType, PublishingStatus, ScheduleStatus, Platform } from '@/lib/types'
import { getSchedulePublishingStatus } from '@/lib/publishingStatus'
import StatusBadge from '@/components/StatusBadge'
import PlatformIcon from '@/components/PlatformIcon'
import { useChannelFilter } from '@/components/ChannelFilterContext'

type StatCounts = {
  todayQueue: number
  scheduled: number
  published: number
  failed: number
}

type UpcomingItem = {
  id: string
  title: string
  platform: Platform
  scheduled_at: string
  status: PublishingStatus
  thumbnail: UpcomingThumbnailData
}

type UpcomingAsset = Pick<Asset, 'id' | 'asset_type' | 'url' | 'thumbnail_url'>

type UpcomingThumbnailData = {
  url: string | null
  kind: 'image' | 'text' | 'play' | 'story' | 'platform'
  platform: Platform
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCounts | null>(null)
  const [todayItems, setTodayItems] = useState<UpcomingItem[]>([])
  const [weekItems, setWeekItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  const { channelFilter } = useChannelFilter()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()

      const [{ data: allSchedulesData }, { data: schedulesData }] = await Promise.all([
        supabase.from('cmp_schedules').select('content_item_id, platform, status, scheduled_at').neq('status', 'skipped'),
        supabase
          .from('cmp_schedules')
          .select('id, content_item_id, platform, status, scheduled_at, cmp_content_items(id, title, content_type, asset_ids)')
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfWeek)
          .eq('status', 'pending')
          .order('scheduled_at'),
      ])

      const filteredAllSchedules =
        channelFilter === 'all'
          ? (allSchedulesData ?? [])
          : (allSchedulesData ?? []).filter((schedule) => schedule.platform === channelFilter)

      const counts: StatCounts = {
        todayQueue: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
      }
      for (const schedule of filteredAllSchedules) {
        const displayStatus = getSchedulePublishingStatus(schedule.status as ScheduleStatus)
        const scheduledAt = new Date(schedule.scheduled_at)
        const isToday = scheduledAt >= new Date(startOfDay) && scheduledAt < new Date(endOfDay)

        if (displayStatus === 'scheduled') {
          counts.scheduled += 1
          if (isToday) counts.todayQueue += 1
        } else if (displayStatus === 'published') {
          counts.published += 1
        } else if (displayStatus === 'failed') {
          counts.failed += 1
        }
      }
      setStats(counts)

      const today: UpcomingItem[] = []
      const week: UpcomingItem[] = []
      const filteredSchedules =
        channelFilter === 'all'
          ? (schedulesData ?? [])
          : (schedulesData ?? []).filter((schedule) => schedule.platform === channelFilter)
      const upcomingAssetIds = Array.from(
        new Set(
          filteredSchedules.flatMap((schedule) => {
            const content = Array.isArray(schedule.cmp_content_items)
              ? schedule.cmp_content_items[0]
              : schedule.cmp_content_items
            return content?.asset_ids ?? []
          })
        )
      )
      const { data: assetData } = upcomingAssetIds.length
        ? await supabase.from('cmp_assets').select('id, asset_type, url, thumbnail_url').in('id', upcomingAssetIds)
        : { data: [] as UpcomingAsset[] }
      const assetsById = new Map((assetData ?? []).map((asset) => [asset.id, asset as UpcomingAsset]))

      for (const s of filteredSchedules) {
        const content = Array.isArray(s.cmp_content_items) ? s.cmp_content_items[0] : s.cmp_content_items
        if (!content) continue
        const assets = getOrderedAssets(content.asset_ids, assetsById)
        const item: UpcomingItem = {
          id: content.id,
          title: content.title,
          platform: s.platform as Platform,
          scheduled_at: s.scheduled_at,
          status: getSchedulePublishingStatus(s.status as ScheduleStatus),
          thumbnail: getUpcomingThumbnail(content.content_type as ContentType, s.platform as Platform, assets),
        }
        if (s.scheduled_at < endOfDay) today.push(item)
        else week.push(item)
      }
      setTodayItems(today)
      setWeekItems(week)
      setLoading(false)
    }
    load()
  }, [channelFilter])

  const statCards = [
    { label: 'คิววันนี้', key: 'todayQueue' as const, tone: 'text-slate-700' },
    { label: 'กำหนดแล้ว', key: 'scheduled' as const, tone: 'text-violet-600' },
    { label: 'เผยแพร่แล้ว', key: 'published' as const, tone: 'text-emerald-600' },
    { label: 'โพสต์ไม่สำเร็จ', key: 'failed' as const, tone: 'text-red-600' },
  ]

  return (
    <>
      <section className="page-header">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">ภาพรวม</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              Evergreen Farming CMP
            </div>
            <Link href="/content/new" className="primary-button px-4 py-2.5 text-sm font-semibold">
              + Create Post
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, key, tone }) => (
          <article key={key} className="surface-card p-5">
            <span className="text-sm text-[var(--muted)]">{label}</span>
            <strong className={`mt-3 block text-[2rem] font-semibold ${tone}`}>
              {loading ? '—' : (stats?.[key] ?? 0)}
            </strong>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ScheduleList title="โพสต์วันนี้" items={todayItems} loading={loading} emptyText="ไม่มีโพสต์วันนี้" />
        <ScheduleList title="สัปดาห์นี้" items={weekItems} loading={loading} emptyText="ไม่มีโพสต์สัปดาห์นี้" />
      </div>
    </>
  )
}

function getOrderedAssets(assetIds: string[] | null, assetsById: Map<string, UpcomingAsset>) {
  return (assetIds ?? []).map((assetId) => assetsById.get(assetId)).filter((asset): asset is UpcomingAsset => Boolean(asset))
}

function getUpcomingThumbnail(contentType: ContentType, platform: Platform, assets: UpcomingAsset[]): UpcomingThumbnailData {
  const imageAsset = assets.find((asset) => asset.asset_type === 'image' && (asset.thumbnail_url || asset.url))
  if (imageAsset) {
    return {
      url: imageAsset.thumbnail_url || imageAsset.url,
      kind: 'image',
      platform,
    }
  }

  const primaryAsset = assets[0]
  if (primaryAsset?.thumbnail_url && (isMotionAsset(primaryAsset.asset_type) || primaryAsset.asset_type === 'story')) {
    return {
      url: primaryAsset.thumbnail_url,
      kind: 'image',
      platform,
    }
  }

  if (contentType === 'video' || contentType === 'reel' || isMotionAsset(primaryAsset?.asset_type)) {
    return { url: null, kind: 'play', platform }
  }

  if (contentType === 'story' || primaryAsset?.asset_type === 'story') {
    return { url: null, kind: 'story', platform }
  }

  if (contentType === 'post' && assets.length === 0) {
    return { url: null, kind: 'text', platform }
  }

  return { url: null, kind: 'platform', platform }
}

function isMotionAsset(assetType?: AssetType) {
  return assetType === 'video' || assetType === 'reel'
}

function ScheduleList({
  title,
  items,
  loading,
  emptyText,
}: {
  title: string
  items: UpcomingItem[]
  loading: boolean
  emptyText: string
}) {
  return (
    <section className="surface-card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <Link href="/planner" className="text-sm font-medium text-[var(--brand)]">
          ดูทั้งหมด →
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id + item.scheduled_at}
              href={`/content/${item.id}`}
              className="surface-muted flex items-center gap-3 p-3 transition-colors hover:bg-white"
            >
              <UpcomingThumbnail thumbnail={item.thumbnail} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{item.title}</span>
                  <StatusBadge status={item.status} />
                </div>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {new Date(item.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}{' '}
                  {new Date(item.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function UpcomingThumbnail({ thumbnail }: { thumbnail: UpcomingThumbnailData }) {
  return (
    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
      {thumbnail.url ? (
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${thumbnail.url}")` }}
          aria-hidden="true"
        />
      ) : (
        <ThumbnailPlaceholder kind={thumbnail.kind} platform={thumbnail.platform} />
      )}
      <span className="absolute -bottom-1 -right-1 origin-bottom-right scale-[0.68] rounded-full border-2 border-white bg-white shadow-sm">
        <PlatformIcon platform={thumbnail.platform} />
      </span>
    </div>
  )
}

function ThumbnailPlaceholder({ kind, platform }: { kind: UpcomingThumbnailData['kind']; platform: Platform }) {
  if (kind === 'platform') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="scale-90">
          <PlatformIcon platform={platform} />
        </div>
      </div>
    )
  }

  const iconClass = 'h-6 w-6'
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-white">
      {kind === 'play' ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8.5 6.75v10.5L17 12 8.5 6.75Z" fill="currentColor" />
        </svg>
      ) : kind === 'story' ? (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7" y="3" width="10" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M11 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 3.75h7l3 3v13.5H7V3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 3.75V7h3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 11h5M9.5 14h5M9.5 17h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}
