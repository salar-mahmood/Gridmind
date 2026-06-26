'use client'

import { useEffect, useState, useCallback } from 'react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RackHeatmap } from '@/components/dashboard/RackHeatmap'
import { PowerChart } from '@/components/dashboard/PowerChart'
import { InsightFeed } from '@/components/dashboard/InsightFeed'
import type { TelemetrySnapshot, GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

function getSettings(): GridMindSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    return JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null') ?? DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedProgress, setSeedProgress] = useState(0)
  const settings = getSettings()

  const fetchTick = useCallback(async () => {
    const res = await fetch('/api/telemetry/generate', { method: 'POST' })
    const data = await res.json()
    setSnapshot(data)
  }, [])

  useEffect(() => {
    const init = async () => {
      const check = await fetch('/api/telemetry/history?range=24h')
      const history = await check.json()
      if (!Array.isArray(history) || history.length === 0) {
        setSeeding(true)
        const res = await fetch('/api/seed', { method: 'POST' })
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const lines = decoder.decode(value).split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const msg = JSON.parse(line)
                if (msg.progress && msg.total) setSeedProgress(Math.round(msg.progress / msg.total * 100))
              } catch { /* ignore */ }
            }
          }
        }
        setSeeding(false)
      }
      fetchTick()
    }
    init()
    const id = setInterval(fetchTick, 30000)
    return () => clearInterval(id)
  }, [fetchTick])

  if (seeding) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400">Seeding historical data... {seedProgress}%</p>
        <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${seedProgress}%` }} />
        </div>
      </div>
    )
  }

  const servers = snapshot?.servers ?? []
  const cooling = snapshot?.cooling ?? []
  const price = snapshot?.price

  const totalPowerKw = servers.reduce((s, sv) => s + sv.power_w / 1000, 0)
  const coolingPowerKw = cooling.reduce((s, c) => s + c.power_w / 1000, 0)
  const pue = totalPowerKw > 0 ? (totalPowerKw + coolingPowerKw) / totalPowerKw : 1.0
  const monthlyCost = totalPowerKw * 24 * 30 * settings.electricityCostPerKwh
  const renewablePct = (price?.renewable_pct ?? 20) / 100
  const co2Kg = totalPowerKw * 24 * 30 * settings.co2Factor * (1 - renewablePct)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Live telemetry — refreshes every 30s</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Power Draw" value={totalPowerKw.toFixed(1)} unit="kW" variant="blue" />
        <MetricCard label="PUE" value={pue.toFixed(3)} variant="green" />
        <MetricCard label="Cooling Load" value={coolingPowerKw.toFixed(1)} unit="kW" variant="blue" />
        <MetricCard label="Est. Monthly Cost" value={`$${monthlyCost.toFixed(0)}`} variant="amber" />
        <MetricCard label="CO₂ Footprint" value={co2Kg.toFixed(0)} unit="kg/mo" variant="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RackHeatmap servers={servers} />
        </div>
        <InsightFeed />
      </div>

      <PowerChart />
    </div>
  )
}
