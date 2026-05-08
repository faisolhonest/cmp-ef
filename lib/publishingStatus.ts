import type { ContentStatus, PublishingStatus, ScheduleStatus } from '@/lib/types'

export type DisplayPublishingStatus = PublishingStatus | 'archived'

type ScheduleLike = {
  status: ScheduleStatus
}

export function getPublishingStatus(
  schedules: ScheduleLike[],
  contentStatus?: ContentStatus | null
): DisplayPublishingStatus {
  if (contentStatus === 'archived') return 'archived'
  if (schedules.length === 0) return 'draft'

  const hasPosted = schedules.some(
    (schedule) => schedule.status === 'auto_posted' || schedule.status === 'manually_posted'
  )
  if (hasPosted) return 'published'
  if (schedules.some((schedule) => schedule.status === 'failed')) return 'failed'
  if (schedules.some((schedule) => schedule.status === 'pending')) return 'scheduled'
  if (schedules.some((schedule) => schedule.status === 'incomplete')) return 'incomplete'

  return 'draft'
}

export function getSchedulePublishingStatus(status: ScheduleStatus): PublishingStatus {
  switch (status) {
    case 'pending':
      return 'scheduled'
    case 'auto_posted':
    case 'manually_posted':
      return 'published'
    case 'failed':
      return 'failed'
    case 'incomplete':
      return 'incomplete'
    default:
      return 'scheduled'
  }
}
