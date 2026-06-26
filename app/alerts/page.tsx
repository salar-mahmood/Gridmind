'use client'

import { useEffect, useState } from 'react'
import type { Alert } from '@/lib/types'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  medium:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  low:      'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ severity: '', resolved: 'false' })

  const loadAlerts = async () => {
    setLoading(true)
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '')
    )
    const res = await fetch(`/api/alerts?${params}`)
    setAlerts(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadAlerts() }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Alerts</h1>

      <div className="flex gap-3 flex-wrap">
        {['', 'critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            onClick={() => setFilters(f => ({ ...f, severity: s }))}
            className={cn(
              'px-3 py-1 rounded-lg text-sm capitalize cursor-pointer transition-colors',
              filters.severity === s ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            )}
          >
            {s || 'All Severities'}
          </button>
        ))}
        <div className="border-l border-slate-700 mx-1" />
        {[['false', 'Open'], ['true', 'Resolved'], ['', 'All']] .map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilters(f => ({ ...f, resolved: val }))}
            className={cn(
              'px-3 py-1 rounded-lg text-sm cursor-pointer transition-colors',
              filters.resolved === val ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Server</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800 animate-pulse">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-slate-800 rounded" />
                  </td>
                </tr>
              ))
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">No alerts found</td>
              </tr>
            ) : alerts.map(alert => (
              <tr key={alert.id} className={cn('border-b border-slate-800', alert.resolved && 'opacity-50')}>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase border', SEVERITY_STYLES[alert.severity])}>
                    {alert.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 capitalize">{alert.type}</td>
                <td className="px-4 py-3 font-mono text-slate-300">{alert.server_id ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{alert.message}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {new Date(alert.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {!alert.resolved && (
                    <button
                      onClick={() => resolve(alert.id)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded cursor-pointer transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                  {alert.resolved && <span className="text-xs text-slate-600">Resolved</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
