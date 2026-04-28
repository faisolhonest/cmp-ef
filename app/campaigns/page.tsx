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

    setCampaigns(
      (campaignData ?? []).map((c) => ({ ...c, content_count: counts[c.id] ?? 0 }))
    )
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
      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '26px',
          padding: '18px 22px',
          backdropFilter: 'blur(18px)',
        }}
        className="flex justify-between items-center gap-4"
      >
        <div>
          <h2 className="text-[1.5rem] font-bold leading-tight">แคมเปญ</h2>
          <p className="text-[var(--muted)] text-sm mt-1">จัดกลุ่มคอนเทนต์ตามแคมเปญ</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-[14px] text-sm font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: 'linear-gradient(135deg, #336bff, #4b91ff)', boxShadow: '0 14px 24px rgba(51,107,255,0.24)' }}
        >
          + สร้างแคมเปญ
        </button>
      </section>

      {/* Create form */}
      {showForm && (
        <section
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(47,102,255,0.3)',
            borderRadius: '22px',
            padding: '20px',
          }}
        >
          <h3 className="font-semibold mb-4">สร้างแคมเปญใหม่</h3>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อแคมเปญ"
              className="px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm focus:border-[var(--brand)] transition-colors"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="คำอธิบาย (ไม่บังคับ)"
              className="px-4 py-2.5 rounded-[12px] border border-[var(--line)] outline-none text-sm focus:border-[var(--brand)] transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-[12px] border border-[var(--line)] text-sm hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={createCampaign}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 rounded-[12px] text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #336bff, #4b91ff)' }}
              >
                {creating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.78)',
          borderRadius: '22px',
          padding: '20px',
          boxShadow: '0 16px 30px rgba(27,43,79,0.06)',
        }}
      >
        {loading ? (
          <p className="text-[var(--muted)] text-center py-10">กำลังโหลด...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-10">ยังไม่มีแคมเปญ</p>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 p-4 rounded-[16px] border border-[var(--line)] bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={
                        c.status === 'active'
                          ? { background: 'rgba(31,191,117,0.12)', color: '#0d8a54' }
                          : { background: 'rgba(111,125,150,0.1)', color: '#6f7d96' }
                      }
                    >
                      {c.status === 'active' ? 'กำลังดำเนินการ' : 'เก็บถาวร'}
                    </span>
                  </div>
                  {c.description && <p className="text-sm text-[var(--muted)] mt-0.5">{c.description}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--muted)]">{c.content_count} คอนเทนต์</span>
                  {c.status === 'active' && (
                    <button
                      onClick={() => archiveCampaign(c.id)}
                      className="text-xs text-[var(--muted)] hover:text-red-500 transition-colors px-3 py-1.5 rounded-[10px] border border-[var(--line)]"
                    >
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
