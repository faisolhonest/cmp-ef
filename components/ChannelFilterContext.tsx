'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { Platform } from '@/lib/types'

export type ChannelFilter = 'all' | Platform

export type ChannelOption = {
  value: ChannelFilter
  label: string
  platform?: Platform
  dotClassName: string
}

export const CHANNEL_OPTIONS: ChannelOption[] = [
  { value: 'all', label: 'ทั้งหมด', dotClassName: 'bg-emerald-500' },
  { value: 'fb', label: 'Facebook', platform: 'fb', dotClassName: 'bg-[#1877F2]' },
  { value: 'ig', label: 'Instagram', platform: 'ig', dotClassName: 'bg-[#E1306C]' },
  { value: 'tiktok', label: 'TikTok', platform: 'tiktok', dotClassName: 'bg-slate-950' },
  { value: 'youtube', label: 'YouTube', platform: 'youtube', dotClassName: 'bg-[#FF0000]' },
  { value: 'shopee', label: 'Shopee', platform: 'shopee', dotClassName: 'bg-[#EE4D2D]' },
  { value: 'other', label: 'อื่นๆ', platform: 'other', dotClassName: 'bg-slate-500' },
]

type ChannelFilterContextValue = {
  channelFilter: ChannelFilter
  setChannelFilter: (value: ChannelFilter) => void
}

const ChannelFilterContext = createContext<ChannelFilterContextValue | null>(null)

export function ChannelFilterProvider({ children }: { children: React.ReactNode }) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const value = useMemo(() => ({ channelFilter, setChannelFilter }), [channelFilter])

  return (
    <ChannelFilterContext.Provider value={value}>
      {children}
    </ChannelFilterContext.Provider>
  )
}

export function useChannelFilter() {
  const context = useContext(ChannelFilterContext)
  if (!context) {
    throw new Error('useChannelFilter must be used within ChannelFilterProvider')
  }
  return context
}
