import type { ContentStatus } from '@/lib/types'

const styles: Record<ContentStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
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
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
