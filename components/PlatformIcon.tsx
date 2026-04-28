import type { Platform } from '@/lib/types'

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
    <span className="inline-flex items-center gap-2">
      <span className={`platform-badge ${platformBadgeStyles[platform]}`}>
        <PlatformSvg platform={platform} />
      </span>
      {showLabel && <span className="text-sm text-slate-600">{labels[platform]}</span>}
    </span>
  )
}

const platformBadgeStyles: Record<Platform, string> = {
  fb: 'border-blue-200 bg-blue-50 text-[#1877F2]',
  ig: 'border-pink-200 bg-pink-50 text-[#E1306C]',
  tiktok: 'border-slate-300 bg-slate-100 text-[#000000]',
  youtube: 'border-red-200 bg-red-50 text-[#FF0000]',
  shopee: 'border-orange-200 bg-orange-50 text-[#EE4D2D]',
  other: 'border-slate-200 bg-white text-slate-600',
}

function PlatformSvg({ platform }: { platform: Platform }) {
  const className = 'icon-svg'

  switch (platform) {
    case 'fb':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="#1877F2" aria-hidden="true">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.017 1.792-4.684 4.533-4.684 1.313 0 2.686.235 2.686.235v2.963H15.83c-1.49 0-1.955.931-1.955 1.887v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.099 24 12.073Z" />
        </svg>
      )
    case 'ig':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
          <path fill="#E1306C" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5Zm8.9 1.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 6.5A5.5 5.5 0 1 1 6.5 12 5.5 5.5 0 0 1 12 6.5Zm0 1.5A4 4 0 1 0 16 12a4 4 0 0 0-4-4Z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
          <path fill="#000000" d="M14.8 3c.3 1.9 1.4 3.4 3.2 4.3 1 .5 2 .8 3 .8v3.2c-1.4 0-2.7-.3-4-.9v5.9c0 3.5-2.8 6.2-6.3 6.2A6.2 6.2 0 0 1 4.5 16c0-3.4 2.8-6.2 6.2-6.2.3 0 .6 0 .9.1v3.3a3.6 3.6 0 0 0-.9-.1c-1.6 0-2.9 1.3-2.9 2.9S9 19 10.6 19s2.8-1.3 2.8-2.9V3h1.4Z" />
          <path fill="#25F4EE" d="M14.2 3v13.1c0 1.6-1.3 2.9-2.8 2.9-.6 0-1.1-.2-1.6-.5a2.9 2.9 0 0 0 4.8-2.3V3h-.4Z" />
          <path fill="#FE2C55" d="M15 3.9c.7 1.3 1.9 2.3 3.4 2.9.8.3 1.7.5 2.6.5V8c-1-.1-2-.3-3-.8-1.7-.8-2.9-2.4-3.2-4.3H15Z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
          <path fill="#FF0000" d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.5 12 4.5 12 4.5s-7.5 0-9.4.6A3 3 0 0 0 .5 7.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-4.8Z" />
          <path fill="#fff" d="m9.75 15.52 6.27-3.52-6.27-3.52v7.04Z" />
        </svg>
      )
    case 'shopee':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
          <path fill="#EE4D2D" d="M7 6.5A5 5 0 0 1 17 6.5h2a1 1 0 0 1 1 1l-.9 10.1A2.5 2.5 0 0 1 16.6 20H7.4a2.5 2.5 0 0 1-2.5-2.4L4 7.5a1 1 0 0 1 1-1h2Zm2 0h6a3 3 0 0 0-6 0Zm2.9 10.1c-1.7 0-3-.7-3.9-1.7l1.6-1.5c.6.6 1.4 1.1 2.4 1.1.7 0 1.1-.2 1.1-.6 0-.5-.6-.7-1.5-.9-1.4-.3-3.2-.8-3.2-2.9 0-1.7 1.4-3 3.7-3 1.5 0 2.8.4 3.8 1.3l-1.4 1.6a3.8 3.8 0 0 0-2.5-.9c-.7 0-1 .3-1 .6 0 .5.6.6 1.5.8 1.4.3 3.2.8 3.2 3 0 1.8-1.3 3.1-3.8 3.1Z" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      )
  }
}
