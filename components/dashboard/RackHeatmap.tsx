import type { ServerTelemetry } from '@/lib/types'
import { cn } from '@/lib/utils'

function tempColor(temp: number): string {
  if (temp >= 75) return 'bg-red-500 text-white shadow-sm shadow-red-500/50'
  if (temp >= 65) return 'bg-amber-500 text-black shadow-sm shadow-amber-500/50'
  if (temp >= 55) return 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/50'
  return 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/50'
}

interface Props { servers: ServerTelemetry[] }

export function RackHeatmap({ servers }: Props) {
  const racks = ['rack-A', 'rack-B', 'rack-C', 'rack-D']
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Server Rack Heatmap</h3>
      <div className="grid grid-cols-4 gap-3">
        {racks.map(rack => (
          <div key={rack}>
            <p className="text-xs text-slate-500 mb-1 text-center">{rack}</p>
            <div className="grid grid-cols-1 gap-1">
              {servers
                .filter(s => s.rack_id === rack)
                .map(s => (
                  <div
                    key={s.server_id}
                    title={`${s.server_id}: ${s.temp_c}°C | ${s.cpu_pct}% CPU | ${s.workload_type}`}
                    className={cn(
                      'rounded text-[10px] font-mono px-1 py-0.5 text-center cursor-default transition-colors',
                      tempColor(s.temp_c)
                    )}
                  >
                    {s.server_id.slice(-2)} {s.temp_c}° {s.cpu_pct}%
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500 flex-wrap">
        <span><span className="inline-block w-2 h-2 bg-emerald-500 rounded-sm mr-1" />Cool (&lt;55°C)</span>
        <span><span className="inline-block w-2 h-2 bg-yellow-400 rounded-sm mr-1" />Warm (55–65°C)</span>
        <span><span className="inline-block w-2 h-2 bg-amber-500 rounded-sm mr-1" />Hot (65–75°C)</span>
        <span><span className="inline-block w-2 h-2 bg-red-500 rounded-sm mr-1" />Critical (&gt;75°C)</span>
      </div>
    </div>
  )
}
