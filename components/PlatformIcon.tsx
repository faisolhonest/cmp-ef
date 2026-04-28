import type { Platform } from '@/lib/types'

const icons: Record<Platform, string> = {
  fb: '🔵',
  ig: '🟣',
  tiktok: '⚫',
  youtube: '🔴',
  shopee: '🟠',
  other: '⚪',
}

const labels: Record<Platform, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shopee: 'Shopee',
  other: 'อื่นๆ',
}

export default function PlatformIcon({ platform, showLabel = false }: { platform: Platform; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{icons[platform]}</span>
      {showLabel && <span className="text-sm text-gray-600">{labels[platform]}</span>}
    </span>
  )
}
