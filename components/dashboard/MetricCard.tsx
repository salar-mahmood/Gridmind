import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  variant?: 'blue' | 'green' | 'amber' | 'red'
}

const VARIANTS = {
  blue:  { card: 'gradient-blue border-blue-800/50',    value: 'text-blue-300' },
  green: { card: 'gradient-green border-emerald-800/50', value: 'text-emerald-300' },
  amber: { card: 'gradient-amber border-amber-800/50',   value: 'text-amber-300' },
  red:   { card: 'gradient-red border-red-800/50',       value: 'text-red-300' },
}

export function MetricCard({ label, value, unit, variant = 'blue' }: MetricCardProps) {
  const v = VARIANTS[variant]
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1', v.card)}>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', v.value)}>
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}
