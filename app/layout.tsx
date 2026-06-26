import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Playfair_Display } from 'next/font/google'
import { AppShell } from '@/components/shared/AppShell'
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

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: 'GridMind — Data Center Energy Optimization',
  description: 'AI-powered energy management for data centers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable}`}>
      <body className="min-h-screen bg-black text-slate-200 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
