export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { MetricsQuerySchema } from '@/lib/validations'

async function computeMetrics(start: string, end: string, co2Factor: number) {
  const { data: servers } = await supabaseServer
    .from('server_telemetry')
    .select('power_w, timestamp')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .eq('is_scheduled', false)

  const { data: cooling } = await supabaseServer
    .from('cooling_state')
    .select('power_w')
    .gte('timestamp', start)
    .lte('timestamp', end)

  const { data: prices } = await supabaseServer
    .from('energy_prices')
    .select('price_per_kwh, renewable_pct')
    .gte('timestamp', start)
    .lte('timestamp', end)

  const intervalHours = 30 / 3600
  const serverKwh = (servers ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const coolingKwh = (cooling ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const totalKwh = serverKwh + coolingKwh
  const avgPue = serverKwh > 0 ? (serverKwh + coolingKwh) / serverKwh : 1.0

  const n = prices?.length ?? 1
  const avgPrice = (prices ?? []).reduce((s, r) => s + r.price_per_kwh, 0) / Math.max(n, 1)
  const avgRenewable = (prices ?? []).reduce((s, r) => s + r.renewable_pct, 0) / Math.max(n, 1)

  const buckets = new Map<string, number>()
  for (const r of (servers ?? [])) {
    const hour = r.timestamp.slice(0, 13)
    buckets.set(hour, (buckets.get(hour) ?? 0) + r.power_w / 1000)
  }
  const peakKw = Math.max(0, ...Array.from(buckets.values()))

  return {
    total_kwh: +totalKwh.toFixed(2),
    avg_pue: +avgPue.toFixed(3),
    peak_kw: +peakKw.toFixed(2),
    total_cost_usd: +(totalKwh * avgPrice).toFixed(2),
    total_co2_kg: +(totalKwh * co2Factor * (1 - avgRenewable / 100)).toFixed(2),
    renewable_pct: +avgRenewable.toFixed(1),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const parsed = MetricsQuerySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    co2Factor: searchParams.get('co2Factor'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', details: parsed.error.format() }, { status: 400 })
  }

  const { startDate, endDate, co2Factor } = parsed.data
  const rangeMs = new Date(endDate).getTime() - new Date(startDate).getTime()
  const priorEnd = startDate
  const priorStart = new Date(new Date(startDate).getTime() - rangeMs).toISOString().slice(0, 10)

  const [current, prior] = await Promise.all([
    computeMetrics(startDate, endDate, co2Factor),
    computeMetrics(priorStart, priorEnd, co2Factor),
  ])

  return NextResponse.json({ current, prior })
}
