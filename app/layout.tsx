import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
