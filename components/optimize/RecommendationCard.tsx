'use client'

import type { AiRecommendation } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_CONFIG: Record<string, { border: string; badge: string; dot: string }> = {
  critical: { border: 'border-l-red-500 border-red-500/20',    badge: 'bg-red-500/20 text-red-400',     dot: 'bg-red-500' },
  high:     { border: 'border-l-amber-500 border-amber-500/20', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
  medium:   { border: 'border-l-blue-500 border-blue-500/20',   badge: 'bg-blue-500/20 text-blue-400',   dot: 'bg-blue-500' },
  low:      { border: 'border-l-slate-500 border-slate-500/20', badge: 'bg-slate-500/20 text-slate-400', dot: 'bg-slate-500' },
}

interface Props {
  rec: AiRecommendation
  onApply: (id: string) => void
  onDismiss: (id: string) => void
}

export function RecommendationCard({ rec, onApply, onDismiss }: Props) {
  const cfg = PRIORITY_CONFIG[rec.priority]
  return (
    <div className={cn('rounded-xl border bg-white/5 backdrop-blur-md p-4 space-y-3 border-l-4', cfg.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase', cfg.badge)}>
            {rec.priority}
          </span>
          <span className="text-xs text-slate-500">{rec.type.replace(/_/g, ' ')}</span>
        </div>
        <span className="text-xs text-slate-500">{Math.round(rec.confidence * 100)}% confidence</span>
      </div>

      <p className="text-sm text-slate-200">{rec.description}</p>

      <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-xs text-slate-300 border-l-2 border-blue-500">
        <span className="text-blue-400 font-semibold">Action: </span>{rec.action}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          {rec.estimated_kwh_savings > 0 && (
            <span className="text-emerald-400">{rec.estimated_kwh_savings} kWh saved</span>
          )}
          {rec.estimated_usd_savings > 0 && (
            <span className="text-emerald-400">${rec.estimated_usd_savings} saved</span>
          )}
        </div>
        {rec.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={() => onDismiss(rec.id)}
              className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => onApply(rec.id)}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded cursor-pointer transition-colors"
            >
              Apply
            </button>
          </div>
        )}
        {rec.status !== 'pending' && (
          <span className="text-xs text-slate-500 capitalize">{rec.status}</span>
        )}
      </div>

      <div className="w-full bg-white/10 rounded-full h-1">
        <div className={cn('h-1 rounded-full', cfg.dot)} style={{ width: `${rec.confidence * 100}%` }} />
      </div>
    </div>
  )
}
