import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Nav } from '@/components/shared/Nav'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'GridMind — Data Center Energy Optimization',
  description: 'AI-powered energy management for data centers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">
        <Nav />
        <main className="max-w-screen-2xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
