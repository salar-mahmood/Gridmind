'use client'

import { ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'

interface TimelineData {
  hour: number
  price: number
  renewable: number
  inference: number
  training: number
  idle: number
}

interface Props {
  data: TimelineData[]
  optimalWindows: number[]
}

export function Timeline({ data, optimalWindows }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex gap-4 text-xs text-slate-500 mb-4 flex-wrap">
        <span><span className="inline-block w-3 h-1 bg-blue-400 mr-1" />Inference servers</span>
        <span><span className="inline-block w-3 h-1 bg-amber-400 mr-1" />Training servers</span>
        <span><span className="inline-block w-3 h-1 bg-emerald-400 mr-1" />Price ($/kWh)</span>
        <span><span className="inline-block w-3 h-1 bg-green-700 mr-1 opacity-50" />Optimal window</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={h => `${h}:00`}
          />
          <YAxis
            yAxisId="servers"
            tick={{ fontSize: 10, fill: '#64748b' }}
            label={{ value: 'Servers', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={v => `$${v.toFixed(2)}`}
          />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
          {optimalWindows.map(h => (
            <ReferenceArea key={h} yAxisId="servers" x1={h} x2={h + 1} fill="#16a34a" fillOpacity={0.15} />
          ))}
          <Bar yAxisId="servers" dataKey="inference" fill="#3b82f6" stackId="a" />
          <Bar yAxisId="servers" dataKey="training" fill="#f59e0b" stackId="a" />
          <Bar yAxisId="servers" dataKey="idle" fill="#475569" stackId="a" />
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#10b981" dot={false} strokeWidth={2} />
          <Area yAxisId="price" type="monotone" dataKey="renewable" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.05} strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
