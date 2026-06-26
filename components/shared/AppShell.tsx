'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Nav } from './Nav'
import { ParticleBackground } from './ParticleBackground'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHero = pathname === '/'

  if (isHero) return <>{children}</>

  return (
    <>
      <ParticleBackground />
      <Nav />
      <motion.main
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-screen-2xl mx-auto px-4 py-6"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(56,189,248,0.04) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(167,139,250,0.04) 0%, transparent 60%)',
        }}
      >
        {children}
      </motion.main>
    </>
  )
}
