'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIndicator } from './StatusIndicator'
import { Zap } from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/optimize',  label: 'Optimize' },
  { href: '/scheduler', label: 'Scheduler' },
  { href: '/reports',   label: 'Reports' },
  { href: '/alerts',    label: 'Alerts' },
  { href: '/settings',  label: 'Settings' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
          <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
          <span className="text-xl font-bold text-white font-playfair">GridMind</span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                pathname === href
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <StatusIndicator />
      </div>
    </nav>
  )
}
