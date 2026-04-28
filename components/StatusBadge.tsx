import type { ContentStatus } from '@/lib/types'

const styles: Record<ContentStatus, string> = {
  draft: 'bg-slate-200 text-slate-700',
  review: 'bg-yellow-200 text-yellow-900',
  approved: 'bg-blue-200 text-blue-900',
  scheduled: 'bg-purple-200 text-purple-900',
  published: 'bg-green-200 text-green-900',
  archived: 'bg-slate-200 text-slate-600',
}

const labels: Record<ContentStatus, string> = {
  draft: 'ร่าง',
  review: 'รอตรวจ',
  approved: 'อนุมัติแล้ว',
  scheduled: 'กำหนดแล้ว',
  published: 'เผยแพร่แล้ว',
  archived: 'เก็บถาวร',
}

export default function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.01em] ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
