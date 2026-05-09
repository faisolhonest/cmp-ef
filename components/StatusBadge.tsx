import type { ContentStatus, PublishingStatus } from '@/lib/types'

type BadgeStatus = ContentStatus | PublishingStatus

const styles: Record<BadgeStatus, string> = {
  draft: 'bg-slate-200 text-slate-700',
  review: 'bg-yellow-200 text-yellow-900',
  approved: 'bg-blue-200 text-blue-900',
  scheduled: 'bg-purple-200 text-purple-900',
  published: 'bg-green-200 text-green-900',
  failed: 'bg-red-100 text-red-800',
  incomplete: 'bg-amber-100 text-amber-800',
  skipped: 'bg-slate-200 text-slate-600',
  archived: 'bg-slate-200 text-slate-600',
}

const labels: Record<BadgeStatus, string> = {
  draft: 'ยังไม่กำหนด',
  review: 'รอตรวจ',
  approved: 'อนุมัติแล้ว',
  scheduled: 'กำหนดแล้ว',
  published: 'เผยแพร่แล้ว',
  failed: 'โพสต์ไม่สำเร็จ',
  incomplete: 'ข้อมูลไม่ครบ',
  skipped: 'ลบแล้ว',
  archived: 'เก็บถาวร',
}

export default function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.01em] ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
