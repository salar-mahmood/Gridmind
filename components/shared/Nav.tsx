'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIndicator } from './StatusIndicator'
import { Zap } from 'lucide-react'

const NAV_LINKS = [
  { href: '/',          label: 'Dashboard' },
  { href: '/optimize',  label: 'Optimize' },
  { href: '/scheduler', label: 'Scheduler' },
  { href: '/reports',   label: 'Reports' },
  { href: '/alerts',    label: 'Alerts' },
  { href: '/settings',  label: 'Settings' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white cursor-pointer">
          <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
          GridMind
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                pathname === href
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
