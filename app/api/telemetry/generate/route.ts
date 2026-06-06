import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { generateTick } from '@/lib/telemetry-sim'

const TEMP_THRESHOLD = 80
const POWER_THRESHOLD = 420

export async function POST() {
  try {
    const tick = generateTick(new Date())

    const { error: serverErr } = await supabaseServer
      .from('server_telemetry').insert(tick.servers)
    if (serverErr) throw serverErr

    const { error: coolingErr } = await supabaseServer
      .from('cooling_state').insert(tick.cooling)
    if (coolingErr) throw coolingErr

    const { error: priceErr } = await supabaseServer
      .from('energy_prices').insert([tick.price])
    if (priceErr) throw priceErr

    const alertRows = tick.servers
      .filter(s => s.temp_c > TEMP_THRESHOLD || s.power_w > POWER_THRESHOLD)
      .map(s => ({
        server_id: s.server_id,
        severity: s.temp_c > TEMP_THRESHOLD ? 'critical' : 'high' as const,
        type: s.temp_c > TEMP_THRESHOLD ? 'temperature' : 'power' as const,
        message: s.temp_c > TEMP_THRESHOLD
          ? `Server ${s.server_id} temperature ${s.temp_c}°C exceeds threshold of ${TEMP_THRESHOLD}°C`
          : `Server ${s.server_id} power draw ${s.power_w}W exceeds threshold of ${POWER_THRESHOLD}W`,
      }))

    if (alertRows.length > 0) {
      await supabaseServer.from('alerts').insert(alertRows)
    }

    return NextResponse.json(tick)
  } catch (err) {
    console.error('generate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
