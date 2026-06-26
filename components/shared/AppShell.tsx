'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHero = pathname === '/'

  if (isHero) return <>{children}</>

  return (
    <>
      <Nav />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">{children}</main>
    </>
  )
}
