'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Platform } from '@/lib/types'
import PlatformIcon from '@/components/PlatformIcon'
import { CHANNEL_OPTIONS, useChannelFilter, type ChannelFilter } from '@/components/ChannelFilterContext'
import FilterDropdown from '@/components/FilterDropdown'

type AnalyticsRow = {
  id: string
  schedule_id: string | null
  platform_post_id: string | null
  title: string
  platform: Platform
  scheduled_at: string
  posted_at: string | null
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  video_views: number | null
  link_clicks: number | null
  reach_delta: number | null
  impressions_delta: number | null
  likes_delta: number | null
  comments_delta: number | null
  fetch_date: string
  fetched_at: string
  content_type: string | null
  thumbnail_url: string | null
}

type MetricKey = 'reach' | 'impressions' | 'likes' | 'comments' | 'shares' | 'video_views' | 'link_clicks'

type TrendPoint = {
  label: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  video_views: number
  link_clicks: number
}

type MetricCard = {
  key: MetricKey
  label: string
  value: number
  helper: string
  tone: string
  badge: string
  accent: string
  spark: number[]
}

type MetricTotals = Record<MetricKey, number>

type ComparisonData = {
  hasPrevious: boolean
  previousTotals: MetricTotals
  summary: Record<MetricKey, string>
}

const platformLabels: Record<Platform, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shopee: 'Shopee',
  other: 'Other',
}

const metricColors = {
  reach: '#2563eb',
  impressions: '#10b981',
  likes: '#8b5cf6',
  comments: '#fb923c',
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [compareRange, setCompareRange] = useState('7')
  const { channelFilter, setChannelFilter } = useChannelFilter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cmp_post_analytics_daily_delta')
        .select(`
          id, schedule_id, fetch_date, fetched_at,
          reach_total, impressions_total, likes_total, comments_total, shares_total,
          reach_delta, impressions_delta, likes_delta, comments_delta,
          schedule:cmp_schedules(platform, platform_post_id, scheduled_at, posted_at,
            content_item:cmp_content_items(title, content_type, asset_ids))
        `)
        .order('fetch_date', { ascending: false })

      // Collect first asset ID per image/album post for thumbnail fetch
      const firstAssetIds = Array.from(new Set(
        (data ?? [])
          .map((a: any) => {
            const ct = a.schedule?.content_item?.content_type
            if (ct === 'image' || ct === 'album') {
              return a.schedule?.content_item?.asset_ids?.[0] ?? null
            }
            return null
          })
          .filter(Boolean)
      )) as string[]

      let assetUrlMap: Record<string, string> = {}
      if (firstAssetIds.length > 0) {
        const { data: assetData } = await supabase
          .from('cmp_assets')
          .select('id, url')
          .in('id', firstAssetIds)
        assetUrlMap = Object.fromEntries((assetData ?? []).map((a: any) => [a.id, a.url ?? '']))
      }

      setRows(
        (data ?? []).map((a: any) => {
          const ct: string | null = a.schedule?.content_item?.content_type ?? null
          const firstAssetId: string | null = a.schedule?.content_item?.asset_ids?.[0] ?? null
          const thumbnailUrl = (ct === 'image' || ct === 'album') && firstAssetId
            ? assetUrlMap[firstAssetId] ?? null
            : null
          return {
            id: a.id,
            schedule_id: a.schedule_id ?? null,
            platform_post_id: a.schedule?.platform_post_id ?? null,
            title: a.schedule?.content_item?.title ?? '-',
            platform: (a.schedule?.platform ?? 'other') as Platform,
            scheduled_at: a.schedule?.scheduled_at ?? '',
            posted_at: a.schedule?.posted_at ?? null,
            reach: a.reach_total,
            impressions: a.impressions_total,
            likes: a.likes_total,
            comments: a.comments_total,
            shares: a.shares_total,
            video_views: null,
            link_clicks: null,
            reach_delta: a.reach_delta,
            impressions_delta: a.impressions_delta,
            likes_delta: a.likes_delta,
            comments_delta: a.comments_delta,
            fetch_date: a.fetch_date ?? '',
            fetched_at: a.fetched_at ?? a.fetch_date ?? '',
            content_type: ct,
            thumbnail_url: thumbnailUrl,
          }
        })
      )
      setLoading(false)
    }
    load()
  }, [])

  const channelFiltered = rows.filter((r) => channelFilter === 'all' || r.platform === channelFilter)

  const filtered = channelFiltered.filter((r) => {
    if (dateFrom && r.fetch_date < dateFrom) return false
    if (dateTo && r.fetch_date > dateTo) return false
    return true
  })

  const latestRows = getLatestRows(filtered)
  const deltaRows = groupAndSumDelta(filtered)
  const trendData = buildTrendData(filtered)
  const totals = sumDeltaMetrics(filtered)
  const compareData = buildComparisonData(channelFiltered, latestRows, Number(compareRange))
  const engagementTotal = totals.likes + totals.comments + totals.shares
  const engagementBase = Math.max(totals.impressions || totals.reach, 1)
  const engagementRate = (engagementTotal / engagementBase) * 100
  const platformData = buildPlatformData(filtered)
  const heatmapData = buildPostingHeatmap(latestRows)
  const bestPlatform = platformData.reduce((best, item) => (item.reach > best.reach ? item : best), platformData[0])
  const bestHour = getBestHour(latestRows)
  const metricCards = buildMetricCards(totals, trendData, latestRows.length, compareData)

  return (
    <>
      <section className="rounded-[24px] border border-white/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[2rem] font-semibold leading-tight text-slate-950">Analytics</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Post and content performance analytics across every channel</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(160px,1fr)_auto_auto_auto_auto] md:items-center xl:min-w-[820px]">
            <div className="min-w-0">
              <FilterDropdown
                label="Channel"
                value={channelFilter}
                onChange={(value) => setChannelFilter(value as ChannelFilter)}
                options={CHANNEL_OPTIONS.map(({ value, label, dotClassName }) => ({ value, label, dotClassName }))}
              />
            </div>
            <label className="input-shell flex min-h-[58px] flex-col justify-center bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
              From
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 bg-transparent text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none" />
            </label>
            <label className="input-shell flex min-h-[58px] flex-col justify-center bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
              To
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 bg-transparent text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none" />
            </label>
            <label className="input-shell flex min-h-[58px] flex-col justify-center bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
              เทียบกับ
              <select value={compareRange} onChange={(e) => setCompareRange(e.target.value)} className="mt-1 min-w-[128px] bg-transparent text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none">
                <option value="7">7 วันก่อนหน้า</option>
                <option value="15">15 วันก่อนหน้า</option>
                <option value="30">30 วันก่อนหน้า</option>
                <option value="60">60 วันก่อนหน้า</option>
                <option value="90">90 วันก่อนหน้า</option>
                <option value="180">180 วันก่อนหน้า</option>
              </select>
            </label>
            <button type="button" className="input-shell flex min-h-[58px] items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">DL</span>
              Export
            </button>
          </div>
        </div>
      </section>

      <section className="-mt-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((card) => (
          <article key={card.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">{card.label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-full shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-4 ring-white ${card.badge}`}>
                <MetricIcon metric={card.key} />
              </span>
            </div>
            <strong className={`mt-2 block text-[1.65rem] font-semibold leading-none ${card.tone}`}>{formatNumber(card.value)}</strong>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{card.helper}</p>
            <MiniSparkline values={card.spark} color={card.accent} />
          </article>
        ))}
      </section>

      <section className="-mt-1 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Performance Trend</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">Derived from fetched analytics snapshots</p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Daily</span>
          </div>
          <div className="mb-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
            <LegendDot color={metricColors.reach} label="Reach" />
            <LegendDot color={metricColors.impressions} label="Impressions" />
            <LegendDot color={metricColors.likes} label="Likes" />
            <LegendDot color={metricColors.comments} label="Comments" />
          </div>
          <TrendChart data={trendData} />
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">Engagement Breakdown</h3>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">All</span>
          </div>
          <div className="grid items-center gap-5 sm:grid-cols-[220px_1fr] xl:grid-cols-1 2xl:grid-cols-[220px_1fr]">
            <DonutChart likes={totals.likes} comments={totals.comments} shares={totals.shares} other={Math.max(totals.link_clicks, 0)} rate={engagementRate} />
            <div className="space-y-3">
              <BreakdownRow label="Likes" color="bg-blue-600" value={totals.likes} total={Math.max(engagementTotal + totals.link_clicks, 1)} />
              <BreakdownRow label="Comments" color="bg-violet-500" value={totals.comments} total={Math.max(engagementTotal + totals.link_clicks, 1)} />
              <BreakdownRow label="Shares" color="bg-orange-400" value={totals.shares} total={Math.max(engagementTotal + totals.link_clicks, 1)} />
              <BreakdownRow label="Other" color="bg-slate-300" value={totals.link_clicks} total={Math.max(engagementTotal + totals.link_clicks, 1)} />
            </div>
          </div>
        </article>
      </section>

      <section className="-mt-2 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">Post Performance</h3>
            <span className="text-xs font-semibold text-[var(--muted)]">{deltaRows.length} posts · {filtered.length} snapshots</span>
          </div>
          {loading ? (
            <p className="py-12 text-center text-[var(--muted)]">Loading...</p>
          ) : deltaRows.length === 0 ? (
            <p className="py-12 text-center text-[var(--muted)]">No analytics data found</p>
          ) : (
            <div className="table-shell">
              <table className="w-full table-fixed text-[13px]">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-[var(--muted)]">
                    <th className="pb-3 text-left font-semibold">Post</th>
                    <th className="pb-3 text-left font-semibold">Channel</th>
                    <th className="pb-3 text-left font-semibold">Posted Date</th>
                    <th className="pb-3 text-right font-semibold">Reach</th>
                    <th className="pb-3 text-right font-semibold">Impressions</th>
                    <th className="pb-3 text-right font-semibold">Likes</th>
                    <th className="pb-3 text-right font-semibold">Comments</th>
                    <th className="pb-3 text-right font-semibold">Shares</th>
                    <th className="pb-3 text-right font-semibold">Eng. Rate</th>
                    <th className="pb-3 text-right font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {deltaRows.map((row) => {
                    const rowEngagement = toNumber(row.likes) + toNumber(row.comments) + toNumber(row.shares)
                    const rowBase = Math.max(toNumber(row.reach) || toNumber(row.impressions), 1)
                    const rowHistory = getDeltaHistory(filtered, row)
                    return (
                      <tr key={row.id} className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/90 hover:shadow-[inset_3px_0_0_rgba(16,185,129,0.35)]">
                        <td className="py-3 pr-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <PostThumbnail contentType={row.content_type} thumbnailUrl={row.thumbnail_url} title={row.title} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{row.title}</p>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--muted)]">Snapshot {formatDate(row.fetched_at)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <PlatformIcon platform={row.platform} showLabel />
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{formatDate(row.posted_at || row.scheduled_at)}</td>
                        <td className="py-3 pr-3 text-right font-semibold text-slate-900">{formatNumber(toNumber(row.reach))}</td>
                        <td className="py-3 pr-3 text-right font-semibold text-slate-900">{formatNumber(toNumber(row.impressions))}</td>
                        <td className="py-3 pr-3 text-right text-slate-700">{formatNumber(toNumber(row.likes))}</td>
                        <td className="py-3 pr-3 text-right text-slate-700">{formatNumber(toNumber(row.comments))}</td>
                        <td className="py-3 pr-3 text-right text-slate-700">{formatNumber(toNumber(row.shares))}</td>
                        <td className="py-3 pr-3 text-right font-semibold text-slate-900">{formatPercent((rowEngagement / rowBase) * 100)}</td>
                        <td className="py-3 text-right">
                          <MiniSparkline values={rowHistory} color="#10b981" compact />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="grid gap-3">
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Performance by Platform</h3>
              <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">All</span>
            </div>
            <div className="space-y-3">
              {platformData.map((item) => (
                <div key={item.platform} className="grid grid-cols-[112px_1fr_auto] items-center gap-3 text-sm">
                  <div className="min-w-0">
                    <PlatformIcon platform={item.platform} showLabel />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.percent}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{formatNumber(item.reach)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Best Posting Time</h3>
              <span className="text-xs text-[var(--muted)]">{bestHour ? `${bestHour}:00` : 'No data'}</span>
            </div>
            <PostingHeatmap values={heatmapData} />
          </article>
        </aside>
      </section>

      <section className="-mt-1 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-950">AI Insights</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard icon="UP" tone="bg-emerald-100 text-emerald-700" title={`Reach total ${formatNumber(totals.reach)}`} text={`${latestRows.length} posts use their latest analytics snapshot. ${compareData.summary.reach}`} />
          <InsightCard icon="ER" tone="bg-orange-100 text-orange-700" title={`Engagement Rate ${formatPercent(engagementRate)}`} text={`Likes, comments, and shares total ${formatNumber(engagementTotal)} interactions.`} />
          <InsightCard icon="TM" tone="bg-violet-100 text-violet-700" title={bestHour ? `Best time ${bestHour}:00` : 'Best time pending'} text="Calculated from posted, scheduled, or fetched timestamps in the visible rows." />
          <InsightCard icon="CH" tone="bg-blue-100 text-blue-700" title={bestPlatform ? `${platformLabels[bestPlatform.platform]} leads reach` : 'Channel mix pending'} text="Use the strongest channel as the first benchmark before redesigning reports." />
        </div>
      </section>
    </>
  )
}

function toNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString()
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('th-TH', { dateStyle: 'medium' })
}

function emptyTotals(): MetricTotals {
  return { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, video_views: 0, link_clicks: 0 }
}

function sumMetrics(rows: AnalyticsRow[]): MetricTotals {
  return rows.reduce(
    (acc, r) => ({
      reach: acc.reach + toNumber(r.reach),
      impressions: acc.impressions + toNumber(r.impressions),
      likes: acc.likes + toNumber(r.likes),
      comments: acc.comments + toNumber(r.comments),
      shares: acc.shares + toNumber(r.shares),
      video_views: acc.video_views + toNumber(r.video_views),
      link_clicks: acc.link_clicks + toNumber(r.link_clicks),
    }),
    emptyTotals()
  )
}

function sumDeltaMetrics(rows: AnalyticsRow[]): MetricTotals {
  return rows.reduce(
    (acc, r) => ({
      reach: acc.reach + toNumber(r.reach_delta),
      impressions: acc.impressions + toNumber(r.impressions_delta),
      likes: acc.likes + toNumber(r.likes_delta),
      comments: acc.comments + toNumber(r.comments_delta),
      shares: acc.shares + toNumber(r.shares),
      video_views: 0,
      link_clicks: 0,
    }),
    emptyTotals()
  )
}

function getStablePostKey(row: AnalyticsRow) {
  return row.schedule_id || row.platform_post_id || row.id
}

function getLatestRows(rows: AnalyticsRow[]) {
  const latest = new Map<string, AnalyticsRow>()

  rows.forEach((row) => {
    const key = getStablePostKey(row)
    const existing = latest.get(key)
    if (!existing || getTimeValue(row.fetched_at) >= getTimeValue(existing.fetched_at)) {
      latest.set(key, row)
    }
  })

  return Array.from(latest.values()).sort((a, b) => getTimeValue(b.fetched_at) - getTimeValue(a.fetched_at))
}

function groupAndSumDelta(rows: AnalyticsRow[]): AnalyticsRow[] {
  const groups = new Map<string, AnalyticsRow>()

  rows.forEach((row) => {
    const key = getStablePostKey(row)
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        ...row,
        reach: toNumber(row.reach_delta),
        impressions: toNumber(row.impressions_delta),
        likes: toNumber(row.likes_delta),
        comments: toNumber(row.comments_delta),
      })
    } else {
      groups.set(key, {
        ...existing,
        reach: existing.reach! + toNumber(row.reach_delta),
        impressions: existing.impressions! + toNumber(row.impressions_delta),
        likes: existing.likes! + toNumber(row.likes_delta),
        comments: existing.comments! + toNumber(row.comments_delta),
      })
    }
  })

  return Array.from(groups.values()).sort((a, b) => getTimeValue(b.fetched_at) - getTimeValue(a.fetched_at))
}

function getDeltaHistory(rows: AnalyticsRow[], target: AnalyticsRow) {
  const key = getStablePostKey(target)
  const values = rows
    .filter((row) => getStablePostKey(row) === key)
    .sort((a, b) => getTimeValue(a.fetched_at) - getTimeValue(b.fetched_at))
    .map((row) => toNumber(row.reach_delta) || toNumber(row.impressions_delta) || toNumber(row.likes_delta))
  return values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0, values[0] ?? 0]
}

function buildComparisonData(rows: AnalyticsRow[], latestRows: AnalyticsRow[], days: number): ComparisonData {
  const currentTotals = sumMetrics(latestRows)
  const latestTime = Math.max(...latestRows.map((row) => getEventTime(row)), 0)

  if (!latestTime || !Number.isFinite(latestTime)) return buildEmptyComparison()

  const windowMs = Math.max(days, 1) * 24 * 60 * 60 * 1000
  const previousEnd = latestTime - windowMs
  const previousStart = previousEnd - windowMs
  const previousRows = getLatestRows(rows.filter((row) => {
    const time = getEventTime(row)
    return time >= previousStart && time < previousEnd
  }))
  const previousTotals = sumMetrics(previousRows)
  const hasPrevious = previousRows.length > 0

  return {
    hasPrevious,
    previousTotals,
    summary: {
      reach: compareText(currentTotals.reach, previousTotals.reach, hasPrevious),
      impressions: compareText(currentTotals.impressions, previousTotals.impressions, hasPrevious),
      likes: compareText(currentTotals.likes, previousTotals.likes, hasPrevious),
      comments: compareText(currentTotals.comments, previousTotals.comments, hasPrevious),
      shares: compareText(currentTotals.shares, previousTotals.shares, hasPrevious),
      video_views: compareText(currentTotals.video_views, previousTotals.video_views, hasPrevious),
      link_clicks: compareText(currentTotals.link_clicks, previousTotals.link_clicks, hasPrevious),
    },
  }
}

function buildEmptyComparison(): ComparisonData {
  return {
    hasPrevious: false,
    previousTotals: emptyTotals(),
    summary: {
      reach: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      impressions: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      likes: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      comments: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      shares: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      video_views: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
      link_clicks: 'ยังไม่มีข้อมูลเทียบย้อนหลัง',
    },
  }
}

function compareText(current: number, previous: number, hasPrevious: boolean) {
  if (!hasPrevious || previous <= 0) return 'ยังไม่มีข้อมูลเทียบย้อนหลัง'
  const change = ((current - previous) / previous) * 100
  if (!Number.isFinite(change)) return 'ยังไม่มีข้อมูลเทียบย้อนหลัง'
  return `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}% จากช่วงก่อนหน้า`
}

function getEventTime(row: AnalyticsRow) {
  return getTimeValue(row.fetched_at || row.posted_at || row.scheduled_at)
}

function getRowHistory(rows: AnalyticsRow[], target: AnalyticsRow) {
  const key = getStablePostKey(target)
  const values = rows
    .filter((row) => getStablePostKey(row) === key)
    .sort((a, b) => getTimeValue(a.fetched_at) - getTimeValue(b.fetched_at))
    .map((row) => toNumber(row.reach) || toNumber(row.impressions) || toNumber(row.likes))

  return values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0, values[0] ?? 0]
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A'
}

function buildTrendData(rows: AnalyticsRow[]): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>()

  rows.forEach((row) => {
    const key = row.fetch_date || getDateKey(row.fetched_at)
    const existing = buckets.get(key) ?? {
      label: key,
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      video_views: 0,
      link_clicks: 0,
    }
    existing.reach += toNumber(row.reach_delta)
    existing.impressions += toNumber(row.impressions_delta)
    existing.likes += toNumber(row.likes_delta)
    existing.comments += toNumber(row.comments_delta)
    buckets.set(key, existing)
  })

  return Array.from(buckets.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-9)
}

function buildMetricCards(totals: MetricTotals, trendData: TrendPoint[], rowCount: number, comparison: ComparisonData): MetricCard[] {
  const sparkValues: Record<MetricKey, number[]> = {
    reach: trendData.map((point) => point.reach),
    impressions: trendData.map((point) => point.impressions),
    likes: trendData.map((point) => point.likes),
    comments: trendData.map((point) => point.comments),
    shares: trendData.map((point) => point.shares),
    video_views: trendData.map((point) => point.video_views),
    link_clicks: trendData.map((point) => point.link_clicks),
  }

  const cards: MetricCard[] = [
    { key: 'reach', label: 'Reach', value: totals.reach, helper: `${rowCount} posts · ${comparison.summary.reach}`, tone: 'text-blue-600', badge: 'bg-blue-50 text-blue-600', accent: '#2563eb', spark: sparkValues.reach },
    { key: 'impressions', label: 'Impressions', value: totals.impressions, helper: comparison.summary.impressions, tone: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', accent: '#10b981', spark: sparkValues.impressions },
    { key: 'likes', label: 'Likes', value: totals.likes, helper: comparison.summary.likes, tone: 'text-green-600', badge: 'bg-green-50 text-green-600', accent: '#22c55e', spark: sparkValues.likes },
    { key: 'comments', label: 'Comments', value: totals.comments, helper: comparison.summary.comments, tone: 'text-orange-600', badge: 'bg-orange-50 text-orange-600', accent: '#fb923c', spark: sparkValues.comments },
    { key: 'shares', label: 'Shares', value: totals.shares, helper: comparison.summary.shares, tone: 'text-slate-700', badge: 'bg-slate-100 text-slate-600', accent: '#94a3b8', spark: sparkValues.shares },
    { key: 'video_views', label: 'Video Views', value: totals.video_views, helper: comparison.summary.video_views, tone: 'text-violet-600', badge: 'bg-violet-50 text-violet-600', accent: '#8b5cf6', spark: sparkValues.video_views },
  ]

  return cards.map((card) => ({
    ...card,
    spark: card.spark.length ? card.spark : [0, 0, 0, 0, 0, 0],
  }))
}

function buildPlatformData(rows: AnalyticsRow[]) {
  const values = CHANNEL_OPTIONS.filter((option) => option.platform).map((option) => {
    const platform = option.platform as Platform
    const reach = rows.filter((row) => row.platform === platform).reduce((sum, row) => sum + toNumber(row.reach_delta), 0)
    return { platform, reach, percent: 0 }
  })
  const maxReach = Math.max(...values.map((item) => item.reach), 1)
  return values.map((item) => ({ ...item, percent: Math.round((item.reach / maxReach) * 100) }))
}

function buildPostingHeatmap(rows: AnalyticsRow[]) {
  const values = Array.from({ length: 7 * 12 }, () => 0)
  rows.forEach((row) => {
    const dateValue = row.posted_at || row.scheduled_at || row.fetched_at
    if (!dateValue) return
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return
    const day = date.getDay()
    const hourBucket = Math.min(11, Math.floor(date.getHours() / 2))
    values[day * 12 + hourBucket] += 1
  })
  return values
}

function getBestHour(rows: AnalyticsRow[]) {
  const hours = Array.from({ length: 24 }, () => 0)
  rows.forEach((row) => {
    const dateValue = row.posted_at || row.scheduled_at || row.fetched_at
    if (!dateValue) return
    const date = new Date(dateValue)
    if (!Number.isNaN(date.getTime())) hours[date.getHours()] += 1
  })
  const best = hours.reduce((bestIndex, count, index) => (count > hours[bestIndex] ? index : bestIndex), 0)
  return hours[best] > 0 ? String(best).padStart(2, '0') : ''
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MetricIcon({ metric }: { metric: MetricKey }) {
  const common = {
    className: 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (metric === 'reach') {
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }

  if (metric === 'impressions') {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

  if (metric === 'likes') {
    return (
      <svg {...common}>
        <path d="M7 10v11" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3l3.4-5.1A2 2 0 0 1 14 6v0Z" />
      </svg>
    )
  }

  if (metric === 'comments') {
    return (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    )
  }

  if (metric === 'shares') {
    return (
      <svg {...common}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4" />
        <path d="m15.4 6.5-6.8 4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="m15 10 4.5-2.5v9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function PostThumbnail({ contentType, thumbnailUrl, title }: { contentType: string | null; thumbnailUrl: string | null; title: string }) {
  const base = 'h-11 w-11 flex-shrink-0 rounded-xl ring-1 ring-white shadow-[0_12px_28px_rgba(15,118,110,0.14)]'
  const iconBox = `${base} flex items-center justify-center`
  const iconProps = { className: 'h-5 w-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

  if ((contentType === 'image' || contentType === 'album') && thumbnailUrl) {
    return <img src={thumbnailUrl} alt={title} className={`${base} object-cover`} />
  }
  if (contentType === 'video') {
    return (
      <div className={`${iconBox} bg-gradient-to-br from-violet-100 via-purple-50 to-blue-100 text-violet-600`}>
        <svg {...iconProps}><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </div>
    )
  }
  if (contentType === 'text') {
    return (
      <div className={`${iconBox} bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100 text-amber-600`}>
        <svg {...iconProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
    )
  }
  return <div className={`${base} bg-slate-100`} />
}

function MiniSparkline({ values, color, compact = false }: { values: number[]; color: string; compact?: boolean }) {
  const width = compact ? 64 : 160
  const height = compact ? 28 : 38
  const points = makePoints(values, width, height, 4)
  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}-${compact ? 'sm' : 'lg'}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? 'ml-auto h-7 w-16' : 'mt-3 h-8 w-full'} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2={width} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} stopOpacity="0.2" />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <path d={`${points.smoothPath} L ${width - 4} ${height - 4} L 4 ${height - 4} Z`} fill={color} opacity="0.1" />
      <path d={points.smoothPath} stroke={`url(#${gradientId})`} strokeWidth={compact ? '2' : '2.4'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.length ? data : [{ label: 'No data', reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, video_views: 0, link_clicks: 0 }]
  const width = 760
  const height = 260
  const padding = { top: 16, right: 24, bottom: 36, left: 42 }
  const maxValue = Math.max(...chartData.flatMap((point) => [point.reach, point.impressions, point.likes, point.comments]), 1)
  const xStep = (width - padding.left - padding.right) / Math.max(chartData.length - 1, 1)

  const coordsFor = (key: 'reach' | 'impressions' | 'likes' | 'comments') =>
    chartData.map((point, index) => {
      const value = point[key]
      const x = padding.left + index * xStep
      const y = height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom)
      return { x, y }
    })

  const pathFor = (key: 'reach' | 'impressions' | 'likes' | 'comments') => makeSmoothPath(coordsFor(key))

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50 to-white">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full" role="img" aria-label="Performance trend chart">
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding.top + line * ((height - padding.top - padding.bottom) / 4)
          return <line key={line} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        })}
        <path d={pathFor('impressions')} fill="none" stroke={metricColors.impressions} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor('reach')} fill="none" stroke={metricColors.reach} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor('likes')} fill="none" stroke={metricColors.likes} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor('comments')} fill="none" stroke={metricColors.comments} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {(['impressions', 'reach', 'likes', 'comments'] as const).flatMap((key) =>
          coordsFor(key).map((point, index) => (
            <circle key={`${key}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={metricColors[key]} stroke="#fff" strokeWidth="2" />
          ))
        )}
        {chartData.map((point, index) => (
          <text key={point.label} x={padding.left + index * xStep} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {formatShortDate(point.label)}
          </text>
        ))}
      </svg>
    </div>
  )
}

function DonutChart({ likes, comments, shares, other, rate }: { likes: number; comments: number; shares: number; other: number; rate: number }) {
  const total = Math.max(likes + comments + shares + other, 1)
  const likesDeg = (likes / total) * 360
  const commentsDeg = likesDeg + (comments / total) * 360
  const sharesDeg = commentsDeg + (shares / total) * 360
  const background = `conic-gradient(#2563eb 0deg ${likesDeg}deg, #8b5cf6 ${likesDeg}deg ${commentsDeg}deg, #fb923c ${commentsDeg}deg ${sharesDeg}deg, #cbd5e1 ${sharesDeg}deg 360deg)`

  return (
    <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full" style={{ background }}>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-xs text-[var(--muted)]">Engagement Rate</span>
        <strong className="mt-2 text-xl font-semibold text-slate-950">{formatPercent(rate)}</strong>
      </div>
    </div>
  )
}

function BreakdownRow({ label, color, value, total }: { label: string; color: string; value: number; total: number }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <span className={`h-3 w-3 rounded ${color}`} />
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{formatPercent((value / total) * 100)} <span className="text-[var(--muted)]">({formatNumber(value)})</span></span>
    </div>
  )
}

function PostingHeatmap({ values }: { values: number[] }) {
  const maxValue = Math.max(...values, 1)
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div>
      <div className="grid grid-cols-[22px_repeat(12,minmax(0,1fr))] gap-1">
        {days.map((day, dayIndex) => (
          <div key={`${day}-${dayIndex}`} className="contents">
            <span className="flex h-5 items-center text-[10px] font-semibold text-[var(--muted)]">{day}</span>
            {Array.from({ length: 12 }).map((_, hourIndex) => {
              const value = values[dayIndex * 12 + hourIndex] ?? 0
              const opacity = value ? 0.18 + (value / maxValue) * 0.82 : 0.08
              return <span key={`${dayIndex}-${hourIndex}`} className="h-5 rounded-[4px] bg-emerald-500" style={{ opacity }} />
            })}
          </div>
        ))}
      </div>
      <div className="ml-[26px] mt-2 grid grid-cols-4 text-[10px] text-[var(--muted)]">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
      </div>
    </div>
  )
}

function InsightCard({ icon, tone, title, text }: { icon: string; tone: string; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-white to-slate-50/90 p-5 shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
      <div className="flex gap-4">
        <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-base font-bold shadow-[0_14px_28px_rgba(15,23,42,0.11)] ring-4 ring-white ${tone}`}>{icon}</span>
        <div>
          <h4 className="text-[15px] font-semibold leading-snug text-slate-950">{title}</h4>
          <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{text}</p>
        </div>
      </div>
    </article>
  )
}

function makePoints(values: number[], width: number, height: number, pad: number) {
  const sourceValues = values.length ? values : [0]
  const safeValues = sourceValues.length === 1 ? [sourceValues[0], sourceValues[0], sourceValues[0]] : sourceValues
  const maxValue = Math.max(...safeValues, 1)
  const step = (width - pad * 2) / Math.max(safeValues.length - 1, 1)
  const line = safeValues
    .map((value, index) => {
      const x = pad + index * step
      const y = height - pad - (value / maxValue) * (height - pad * 2)
      return `${x},${y}`
    })
    .join(' ')
  const smoothPath = makeSmoothPath(
    safeValues.map((value, index) => ({
      x: pad + index * step,
      y: height - pad - (value / maxValue) * (height - pad * 2),
    }))
  )
  return { line, smoothPath }
}

function makeSmoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
  }, '')
}

function getDateKey(value: string | null | undefined) {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toISOString().slice(0, 10)
}

function getTimeValue(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

