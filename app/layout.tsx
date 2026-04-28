import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'CMP - Evergreen Farming',
  description: 'Content Management Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="app-body">
        <div className="app-shell">
          <Sidebar />
          <main className="main-panel">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
