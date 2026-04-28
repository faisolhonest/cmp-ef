'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Campaign } from '@/lib/types'

type CampaignWithCount = Campaign & { content_count: number }

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const [{ data: campaignData }, { data: countData }] = await Promise.all([
      supabase.from('cmp_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('cmp_content_items').select('campaign_id'),
    ])

    const counts: Record<string, number> = {}
    for (const item of countData ?? []) {
      if (item.campaign_id) counts[item.campaign_id] = (counts[item.campaign_id] ?? 0) + 1
    }

    setCampaigns((campaignData ?? []).map((c) => ({ ...c, content_count: counts[c.id] ?? 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createCampaign() {
    if (!newName.trim()) return
    setCreating(true)
    await supabase.from('cmp_campaigns').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      status: 'active',
    })
    setNewName('')
    setNewDesc('')
    setShowForm(false)
    setCreating(false)
    load()
  }

  async function archiveCampaign(id: string) {
    await supabase.from('cmp_campaigns').update({ status: 'archived' }).eq('id', id)
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: 'archived' } : c))
  }

  return (
    <>
      <section className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[1.75rem] font-semibold leading-tight text-slate-950">แคมเปญ</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">จัดกลุ่มคอนเทนต์ตามแคมเปญ</p>
        </div>
        <button onClick={() => setShowForm(true)} className="primary-button px-4 py-2.5 text-sm font-semibold">
          + สร้างแคมเปญ
        </button>
      </section>

      {showForm && (
        <section className="surface-card p-5 md:p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-950">สร้างแคมเปญใหม่</h3>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อแคมเปญ"
              className="input-shell px-4 py-2.5 text-sm outline-none"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="คำอธิบาย (ไม่บังคับ)"
              className="input-shell px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="secondary-button px-4 py-2 text-sm">
                ยกเลิก
              </button>
              <button onClick={createCampaign} disabled={creating || !newName.trim()} className="primary-button px-5 py-2 text-sm font-semibold disabled:opacity-50">
                {creating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="surface-card p-5 md:p-6">
        {loading ? (
          <p className="py-10 text-center text-[var(--muted)]">กำลังโหลด...</p>
        ) : campaigns.length === 0 ? (
          <p className="py-10 text-center text-[var(--muted)]">ยังไม่มีแคมเปญ</p>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => (
              <div key={c.id} className="surface-muted flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {c.status === 'active' ? 'กำลังดำเนินการ' : 'เก็บถาวร'}
                    </span>
                  </div>
                  {c.description && <p className="mt-1 text-sm text-[var(--muted)]">{c.description}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--muted)]">{c.content_count} คอนเทนต์</span>
                  {c.status === 'active' && (
                    <button onClick={() => archiveCampaign(c.id)} className="secondary-button px-3 py-1.5 text-xs text-[var(--muted)]">
                      เก็บถาวร
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
