export type ContentStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'archived'
export type ScheduleStatus = 'pending' | 'auto_posted' | 'manually_posted' | 'failed' | 'skipped' | 'incomplete'
export type PublishingStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'incomplete' | 'skipped'
export type Platform = 'fb' | 'ig' | 'tiktok' | 'youtube' | 'shopee' | 'other'
export type PostMode = 'auto' | 'manual'
export type ContentType = 'post' | 'reel' | 'story' | 'video' | 'live_teaser'
export type AssetType = 'image' | 'video' | 'reel' | 'story' | 'other'
export type CampaignStatus = 'active' | 'archived'

export interface Campaign {
  id: string
  name: string
  description: string | null
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  name: string
  asset_type: AssetType
  url: string
  thumbnail_url: string | null
  tags: string[] | null
  notes: string | null
  created_at: string
}

export interface ContentItem {
  id: string
  campaign_id: string | null
  title: string
  content_type: ContentType
  caption_main: string | null
  tags: string[] | null
  status: ContentStatus
  asset_ids: string[] | null
  created_at: string
  updated_at: string
}

export interface ContentItemWithRelations extends ContentItem {
  campaign?: Campaign | null
  asset?: Asset | null
  schedules?: Schedule[]
}

export interface Schedule {
  id: string
  content_item_id: string
  platform: Platform
  scheduled_at: string
  post_mode: PostMode
  status: ScheduleStatus
  platform_post_id: string | null
  posted_at: string | null
  n8n_job_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PostAnalytics {
  id: string
  schedule_id: string
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  fetched_at: string
}
