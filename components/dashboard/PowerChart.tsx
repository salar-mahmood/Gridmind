'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { HistoryBucket } from '@/lib/types'

type Range = '24h' | '7d' | '30d'

export function PowerChart() {
  const [range, setRange] = useState<Range>('24h')
  const [data, setData] = useState<HistoryBucket[]>([])

  useEffect(() => {
    fetch(`/api/telemetry/history?range=${range}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [range])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">Power Consumption</h3>
        <div className="flex gap-1">
          {(['24h', '7d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit=" kW" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}
            formatter={(v) => [`${Number(v).toFixed(1)} kW`]}
          />
          <Line type="monotone" dataKey="total_kw" stroke="#3b82f6" dot={false} strokeWidth={2} name="IT Power" />
          <Line type="monotone" dataKey="cooling_kw" stroke="#10b981" dot={false} strokeWidth={1.5} name="Cooling" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
