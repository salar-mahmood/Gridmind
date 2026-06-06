import type { ServerTelemetry, CoolingState, EnergyPrice, WorkloadType } from './types'

export const SERVERS = Array.from({ length: 20 }, (_, i) => ({
  id: `srv-${String(i + 1).padStart(2, '0')}`,
  rack: `rack-${'ABCD'[Math.floor(i / 5)]}`,
}))

export const CRAC_UNITS = ['crac-1', 'crac-2', 'crac-3', 'crac-4']

// Deterministic pseudo-random from a numeric seed
function seededNoise(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function getAmbientTemp(hour: number): number {
  return 20 + 8 * Math.sin(((hour - 6) * Math.PI) / 12)
}

function getWorkload(serverIndex: number, hour: number): WorkloadType {
  if (serverIndex <= 1 && hour >= 9 && hour < 17) return 'training'
  if (serverIndex >= 15 && (hour < 6 || hour >= 22)) return 'idle'
  return 'inference'
}

export function getPriceAt(hour: number): number {
  let base: number
  if (hour >= 23 || hour < 6) base = 0.05
  else if ((hour >= 6 && hour < 9) || (hour >= 18 && hour < 23)) base = 0.10
  else base = 0.18
  return +(base + (seededNoise(hour * 7) - 0.5) * 0.01).toFixed(4)
}

export function getRenewableAt(hour: number, at: Date): number {
  const doy = Math.floor(at.getTime() / 86400000)
  const solar = Math.max(0, 40 * Math.exp(-((hour - 12) ** 2) / 18))
  const wind = 10 + (seededNoise(doy * 24 + hour) - 0.5) * 10
  return +Math.min(95, solar + wind).toFixed(2)
}

export interface TelemetryTick {
  servers: Omit<ServerTelemetry, 'id'>[]
  cooling: Omit<CoolingState, 'id'>[]
  price: Omit<EnergyPrice, 'id'>
}

export function generateTick(at: Date): TelemetryTick {
  const hour = at.getHours()
  const min = at.getMinutes()
  const seed = Math.floor(at.getTime() / 1000)
  const ambient = getAmbientTemp(hour)

  const servers: Omit<ServerTelemetry, 'id'>[] = SERVERS.map(({ id, rack }, i) => {
    const wt = getWorkload(i, hour)
    const baseCpu = wt === 'training' ? 80 : wt === 'idle' ? 10 : 45
    const s = seed + i * 100 + min
    const cpu = Math.min(100, Math.max(5, baseCpu + (seededNoise(s) - 0.5) * 10 + 5 * Math.sin((hour * Math.PI) / 12)))
    const ram = Math.min(100, Math.max(10, cpu * 0.7 + (seededNoise(s + 1) - 0.5) * 8))
    const temp = Math.min(88, ambient + cpu * 0.55 + (seededNoise(s + 2) - 0.5) * 3)
    const power = 80 + (cpu / 100) * 370 + (seededNoise(s + 3) - 0.5) * 10
    return {
      server_id: id, rack_id: rack,
      cpu_pct: +cpu.toFixed(2), ram_pct: +ram.toFixed(2),
      temp_c: +temp.toFixed(2), power_w: +power.toFixed(2),
      workload_type: wt, is_scheduled: false, timestamp: at.toISOString(),
    }
  })

  const avgTemp = servers.reduce((s, sv) => s + sv.temp_c, 0) / servers.length
  const fanBase = Math.min(100, Math.max(20, (avgTemp - ambient - 5) * 3 + 20))

  const cooling: Omit<CoolingState, 'id'>[] = CRAC_UNITS.map((unit_id, i) => {
    const fan = Math.min(100, fanBase + (seededNoise(seed + i * 7) - 0.5) * 5)
    return {
      unit_id,
      setpoint_c: +(ambient + 5).toFixed(2),
      fan_speed_pct: +fan.toFixed(2),
      power_w: +(500 + (fan / 100) * 3000).toFixed(2),
      timestamp: at.toISOString(),
    }
  })

  return {
    servers,
    cooling,
    price: {
      price_per_kwh: getPriceAt(hour),
      renewable_pct: getRenewableAt(hour, at),
      timestamp: at.toISOString(),
    },
  }
}
