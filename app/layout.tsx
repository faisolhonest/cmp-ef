import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'CMP — Evergreen Farming',
  description: 'Content Management Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="p-6">
        <div
          className="max-w-[1480px] mx-auto grid overflow-hidden"
          style={{
            gridTemplateColumns: '240px minmax(0, 1fr)',
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.75)',
            borderRadius: '34px',
            boxShadow: '0 30px 60px rgba(11,25,55,0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Sidebar />
          <main className="p-6 flex flex-col gap-[18px] min-h-[calc(100vh-48px)]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
