'use client'

import { useEffect, useState } from 'react'
import type { AiRecommendation } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500 text-red-400',
  high:     'border-l-amber-500 text-amber-400',
  medium:   'border-l-blue-500 text-blue-400',
  low:      'border-l-slate-500 text-slate-400',
}

export function InsightFeed() {
  const [items, setItems] = useState<AiRecommendation[]>([])

  useEffect(() => {
    const load = () =>
      fetch('/api/recommendations?status=pending')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setItems(data) })
        .catch(console.error)
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 h-full flex flex-col">
      <h3 className="text-sm font-medium text-slate-400 mb-3">AI Insights</h3>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-80">
        {items.length === 0 ? (
          <p className="text-xs text-slate-600 text-center pt-8">Run AI analysis to see recommendations</p>
        ) : (
          items.slice(0, 10).map(item => (
            <div key={item.id} className={cn('rounded-lg border-l-4 bg-white/5 backdrop-blur-sm p-2.5 text-xs border-r-0 border-t-0 border-b-0', PRIORITY_STYLES[item.priority])}>
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
