'use client'

import { useEffect, useState } from 'react'
import type { AiRecommendation } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  high:     'bg-amber-500/10 border-amber-500/30 text-amber-400',
  medium:   'bg-blue-500/10 border-blue-500/30 text-blue-400',
  low:      'bg-slate-500/10 border-slate-500/30 text-slate-400',
}

export function InsightFeed() {
  const [items, setItems] = useState<AiRecommendation[]>([])

  useEffect(() => {
    const load = () =>
      fetch('/api/recommendations?status=pending')
        .then(r => r.json())
        .then(setItems)
        .catch(console.error)
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 h-full flex flex-col">
      <h3 className="text-sm font-medium text-slate-400 mb-3">AI Insights</h3>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-80">
        {items.length === 0 ? (
          <p className="text-xs text-slate-600 text-center pt-8">Run AI analysis to see recommendations</p>
        ) : (
          items.slice(0, 10).map(item => (
            <div key={item.id} className={cn('rounded-lg border p-2.5 text-xs', PRIORITY_STYLES[item.priority])}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold uppercase tracking-wide">{item.priority}</span>
                <span className="text-slate-500">{item.type.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-slate-300 line-clamp-2">{item.description}</p>
              {item.estimated_usd_savings > 0 && (
                <p className="text-emerald-400 mt-1">Est. savings: ${item.estimated_usd_savings}/mo</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
