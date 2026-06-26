'use client'

import { useState } from 'react'
import type { MetricsResponse, GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

function getSettings(): GridMindSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { return JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null') ?? DEFAULT_SETTINGS }
  catch { return DEFAULT_SETTINGS }
}

function trend(current: number, prior: number): string {
  if (prior === 0) return '—'
  const pct = ((current - prior) / prior * 100).toFixed(1)
  return `${current >= prior ? '+' : ''}${pct}%`
}

function trendColor(current: number, prior: number, lowerIsBetter = true): string {
  if (prior === 0) return 'text-slate-400'
  const better = lowerIsBetter ? current < prior : current > prior
  return better ? 'text-emerald-400' : 'text-red-400'
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const loadMetrics = async () => {
    setLoading(true)
    const settings = getSettings()
    const res = await fetch(`/api/reports/metrics?startDate=${startDate}&endDate=${endDate}&co2Factor=${settings.co2Factor}`)
    const data = await res.json()
    setMetrics(data)
    setLoading(false)
  }

  const generateSummary = async () => {
    setSummaryLoading(true)
    const settings = getSettings()
    const res = await fetch('/api/ai/report', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, co2Factor: settings.co2Factor }),
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    setSummary(data.summary)
    setSummaryLoading(false)
  }

  const c = metrics?.current
  const p = metrics?.prior

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Energy Reports</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={loadMetrics}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
        >
          {loading ? 'Loading...' : 'Load Report'}
        </button>
      </div>

      {c && p && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total kWh',    curr: c.total_kwh,      prior: p.total_kwh,      unit: ' kWh', lower: true },
              { label: 'Avg PUE',      curr: c.avg_pue,        prior: p.avg_pue,        unit: '',     lower: true },
              { label: 'Peak Load',    curr: c.peak_kw,        prior: p.peak_kw,        unit: ' kW',  lower: true },
              { label: 'Total Cost',   curr: c.total_cost_usd, prior: p.total_cost_usd, unit: '$',    lower: true },
              { label: 'CO₂',          curr: c.total_co2_kg,   prior: p.total_co2_kg,   unit: ' kg',  lower: true },
              { label: 'Renewable %',  curr: c.renewable_pct,  prior: p.renewable_pct,  unit: '%',    lower: false },
            ].map(({ label, curr, prior, unit, lower }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-xl font-bold text-white mt-1">{curr.toFixed(1)}{unit}</p>
                <p className={`text-xs mt-1 ${trendColor(curr, prior, lower)}`}>
                  {trend(curr, prior)} vs prior period
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors"
            >
              {summaryLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  GridMind is writing...
                </>
              ) : 'Generate AI Summary'}
            </button>
          </div>

          {summary && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wide">Executive Summary</h3>
              <div className="space-y-3">
                {summary.split('\n\n').map((para, i) => (
                  <p key={i} className="text-slate-300 leading-relaxed text-sm">{para}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
