import type { PublishingStatus, ScheduleStatus } from '@/lib/types'

type ScheduleLike = {
  status: ScheduleStatus
}

export function getPublishingStatus(schedules: ScheduleLike[]): PublishingStatus {
  if (schedules.length === 0) return 'draft'
  if (schedules.some((schedule) => schedule.status === 'failed' || schedule.status === 'incomplete')) return 'failed'
  if (schedules.some((schedule) => schedule.status === 'pending')) return 'scheduled'

  const allPosted = schedules.every(
    (schedule) => schedule.status === 'auto_posted' || schedule.status === 'manually_posted'
  )

  return allPosted ? 'published' : 'scheduled'
}
