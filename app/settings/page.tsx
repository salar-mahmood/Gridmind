'use client'

import { useState, useEffect } from 'react'
import type { GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<GridMindSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null')
      if (s) setSettings(s)
    } catch { /* ignore */ }
  }, [])

  const save = () => {
    localStorage.setItem('gridmind_settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Energy Configuration</h2>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Electricity Cost ($/kWh)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            max="2"
            value={settings.electricityCostPerKwh}
            onChange={e => setSettings(s => ({ ...s, electricityCostPerKwh: parseFloat(e.target.value) }))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full"
          />
          <p className="text-xs text-slate-500 mt-1">Used to calculate monthly cost and cost savings on the dashboard</p>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">CO₂ Emission Factor (kg/kWh)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="2"
            value={settings.co2Factor}
            onChange={e => setSettings(s => ({ ...s, co2Factor: parseFloat(e.target.value) }))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full"
          />
          <p className="text-xs text-slate-500 mt-1">Applied to all CO₂ calculations including reports and AI summaries</p>
        </div>

        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm">
          <p className="text-slate-400 font-medium mb-1">Alert Thresholds (v1 hardcoded)</p>
          <ul className="text-slate-500 text-xs space-y-1">
            <li>• Temperature: 80°C (critical alert)</li>
            <li>• Power draw: 420W per server (high alert)</li>
          </ul>
        </div>

        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm">
          <p className="text-slate-400 font-medium mb-1">AI Analysis Frequency</p>
          <p className="text-slate-500 text-xs">Manual (trigger from /optimize page). Scheduled intervals coming in v2.</p>
        </div>
      </div>

      <button
        onClick={save}
        className={`px-6 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors ${
          saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
