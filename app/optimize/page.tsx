'use client'

import { useState } from 'react'
import type { AiRecommendation } from '@/lib/types'
import { RecommendationCard } from '@/components/optimize/RecommendationCard'

export default function OptimizePage() {
  const [recs, setRecs] = useState<AiRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/optimize', { method: 'POST' })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setRecs(data)
        setLastRun(new Date())
      } else {
        setError(data.error ?? 'Analysis failed')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: 'applied' | 'dismissed') => {
    await fetch(`/api/recommendations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: { 'Content-Type': 'application/json' },
    })
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Optimization Engine</h1>
          {lastRun && <p className="text-sm text-slate-500 mt-1">Last analysis: {lastRun.toLocaleTimeString()}</p>}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 cursor-pointer transition-colors"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              GridMind is analyzing...
            </>
          ) : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && recs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onApply={id => updateStatus(id, 'applied')}
              onDismiss={id => updateStatus(id, 'dismissed')}
            />
          ))}
        </div>
      )}

      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-20 text-slate-600">
          <p className="text-lg">Click &quot;Run Analysis&quot; to generate AI recommendations</p>
        </div>
      )}
    </div>
  )
}
