export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getPriceAt, getRenewableAt } from '@/lib/telemetry-sim'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, h) => h)

  const priceData = hours.map(h => ({ hour: h, price: getPriceAt(h) }))
  const renewableData = hours.map(h => ({ hour: h, renewable: getRenewableAt(h, now) }))

  const optimalWindows = hours.filter(h => getPriceAt(h) < 0.08 && getRenewableAt(h, now) > 30)

  // Current workload distribution from last tick
  const since = new Date(Date.now() - 35000).toISOString()
  const { data: recent } = await supabaseServer
    .from('server_telemetry')
    .select('workload_type')
    .gte('timestamp', since)
    .eq('is_scheduled', false)

  const workloadCounts = { inference: 0, training: 0, idle: 0 }
  for (const row of (recent ?? [])) {
    workloadCounts[row.workload_type as keyof typeof workloadCounts]++
  }

  return NextResponse.json({ priceData, renewableData, optimalWindows, workloadCounts })
}
