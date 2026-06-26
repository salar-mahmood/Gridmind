export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { HistoryRangeSchema } from '@/lib/validations'

const RANGE_CONFIG = {
  '24h': { hours: 24,  bucketMs: 60_000 },
  '7d':  { hours: 168, bucketMs: 3_600_000 },
  '30d': { hours: 720, bucketMs: 21_600_000 },
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? '24h'
  const parsed = HistoryRangeSchema.safeParse(range)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const { hours, bucketMs } = RANGE_CONFIG[parsed.data]
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()

  const [serverRes, coolingRes] = await Promise.all([
    supabaseServer
      .from('server_telemetry')
      .select('timestamp, power_w')
      .gte('timestamp', since)
      .eq('is_scheduled', false)
      .order('timestamp', { ascending: true }),
    supabaseServer
      .from('cooling_state')
      .select('timestamp, power_w')
      .gte('timestamp', since)
      .order('timestamp', { ascending: true }),
  ])

  if (serverRes.error) return NextResponse.json({ error: serverRes.error.message }, { status: 500 })
  if (coolingRes.error) return NextResponse.json({ error: coolingRes.error.message }, { status: 500 })

  type Bucket = { serverKw: number; coolingKw: number }
  const buckets = new Map<number, Bucket>()
  const slot = (ts: string) => Math.floor(new Date(ts).getTime() / bucketMs) * bucketMs

  for (const row of serverRes.data ?? []) {
    const t = slot(row.timestamp)
    const b = buckets.get(t) ?? { serverKw: 0, coolingKw: 0 }
    b.serverKw += row.power_w / 1000
    buckets.set(t, b)
  }

  for (const row of coolingRes.data ?? []) {
    const t = slot(row.timestamp)
    const b = buckets.get(t) ?? { serverKw: 0, coolingKw: 0 }
    b.coolingKw += row.power_w / 1000
    buckets.set(t, b)
  }

  const result = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, b]) => {
      const totalKw = b.serverKw + b.coolingKw
      const pue = b.serverKw > 0 ? totalKw / b.serverKw : 1.0
      return {
        timestamp: new Date(t).toISOString(),
        total_kw: +totalKw.toFixed(2),
        cooling_kw: +b.coolingKw.toFixed(2),
        pue: +pue.toFixed(3),
      }
    })

  return NextResponse.json(result)
}
