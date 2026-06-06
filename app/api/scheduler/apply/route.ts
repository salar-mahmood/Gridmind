import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { SchedulerApplySchema } from '@/lib/validations'
import { getPriceAt, SERVERS } from '@/lib/telemetry-sim'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = SchedulerApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const today = new Date()
  today.setMinutes(0, 0, 0)

  const rows = parsed.data.assignments.map(({ serverId, hour, workloadType }) => {
    const server = SERVERS.find(s => s.id === serverId)!
    const ts = new Date(today)
    ts.setHours(hour)
    return {
      server_id: serverId,
      rack_id: server.rack,
      cpu_pct: workloadType === 'training' ? 85 : workloadType === 'idle' ? 10 : 50,
      ram_pct: workloadType === 'training' ? 75 : workloadType === 'idle' ? 15 : 45,
      temp_c: workloadType === 'training' ? 72 : workloadType === 'idle' ? 30 : 55,
      power_w: workloadType === 'training' ? 390 : workloadType === 'idle' ? 90 : 210,
      workload_type: workloadType,
      is_scheduled: true,
      timestamp: ts.toISOString(),
    }
  })

  // beforeCost: what these workloads would cost if run right now (current price)
  // afterCost: what they'll cost at each assignment's scheduled hour
  const currentHour = new Date().getHours()
  const beforeCost = rows.reduce((s, r) => s + (r.power_w / 1000) * getPriceAt(currentHour), 0)
  const afterCost = rows.reduce((s, r) => s + (r.power_w / 1000) * getPriceAt(new Date(r.timestamp).getHours()), 0)

  const { error } = await supabaseServer.from('server_telemetry').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    applied: rows.length,
    beforeCost: +beforeCost.toFixed(4),
    afterCost: +afterCost.toFixed(4),
    savingsUsd: +(beforeCost - afterCost).toFixed(4),
  })
}
