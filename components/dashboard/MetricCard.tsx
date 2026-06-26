'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  variant?: 'blue' | 'green' | 'amber' | 'red'
  index?: number
}

const VARIANTS = {
  blue:  { border: 'border-blue-500/30',    shadow: 'shadow-blue-500/20',    value: 'text-blue-300' },
  green: { border: 'border-emerald-500/30', shadow: 'shadow-emerald-500/20', value: 'text-emerald-300' },
  amber: { border: 'border-amber-500/30',   shadow: 'shadow-amber-500/20',   value: 'text-amber-300' },
  red:   { border: 'border-red-500/30',     shadow: 'shadow-red-500/20',     value: 'text-red-300' },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number] } },
}

export function MetricCard({ label, value, unit, variant = 'blue', index = 0 }: MetricCardProps) {
  const v = VARIANTS[variant]
  return (
    <motion.div
      variants={item}
      custom={index}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-1 bg-white/5 backdrop-blur-md shadow-lg',
        v.border,
        v.shadow
      )}
    >
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', v.value)}>
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </motion.div>
  )
}
