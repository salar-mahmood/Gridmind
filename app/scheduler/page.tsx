'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '@/components/scheduler/Timeline'

interface SchedulerData {
  priceData: { hour: number; price: number }[]
  renewableData: { hour: number; renewable: number }[]
  optimalWindows: number[]
  workloadCounts: { inference: number; training: number; idle: number }
}

export default function SchedulerPage() {
  const [data, setData] = useState<SchedulerData | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ beforeCost: number; afterCost: number; savingsUsd: number } | null>(null)

  useEffect(() => {
    fetch('/api/scheduler')
      .then(r => r.json())
      .then(d => { if (d?.priceData && d?.optimalWindows) setData(d) })
      .catch(console.error)
  }, [])

  const applySchedule = async () => {
    if (!data) return
    setApplying(true)
    const assignments = data.optimalWindows.slice(0, 3).map((hour, i) => ({
      serverId: `srv-${String(i + 3).padStart(2, '0')}`,
      hour,
      workloadType: 'training' as const,
    }))
    const res = await fetch('/api/scheduler/apply', {
      method: 'POST',
      body: JSON.stringify({ assignments }),
      headers: { 'Content-Type': 'application/json' },
    })
    const r = await res.json()
    if (res.ok) setResult(r)
    setApplying(false)
  }

  const timelineData = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    price: data?.priceData.find(p => p.hour === h)?.price ?? 0,
    renewable: data?.renewableData.find(p => p.hour === h)?.renewable ?? 0,
    inference: h >= 9 && h < 17 ? 15 : 12,
    training: h >= 9 && h < 17 ? 3 : 1,
    idle: h >= 9 && h < 17 ? 2 : 7,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-playfair">Workload Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">
            Green bands = optimal windows (low price + high renewable)
          </p>
        </div>
        <button
          onClick={applySchedule}
          disabled={applying || !data}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors"
        >
          {applying ? 'Applying...' : 'Apply AI Schedule'}
        </button>
      </div>

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Before</p>
            <p className="text-lg font-bold text-white">${result.beforeCost.toFixed(4)}/h</p>
          </div>
          <div>
            <p className="text-slate-400">After</p>
            <p className="text-lg font-bold text-white">${result.afterCost.toFixed(4)}/h</p>
          </div>
          <div>
            <p className="text-slate-400">Savings</p>
            <p className="text-lg font-bold text-emerald-400">${result.savingsUsd.toFixed(4)}/h</p>
          </div>
        </div>
      )}

      <Timeline data={timelineData} optimalWindows={data?.optimalWindows ?? []} />
    </div>
  )
}
