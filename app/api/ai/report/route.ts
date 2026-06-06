import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { anthropic, MODEL, REPORT_SYSTEM_PROMPT } from '@/lib/claude'
import { ReportBodySchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = ReportBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const { startDate, endDate, co2Factor } = parsed.data

  // Fetch aggregate metrics
  const { data: serverData } = await supabaseServer
    .from('server_telemetry')
    .select('power_w, timestamp')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .eq('is_scheduled', false)

  const { data: priceData } = await supabaseServer
    .from('energy_prices')
    .select('price_per_kwh, renewable_pct')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)

  const intervalHours = 30 / 3600
  const totalKwh = (serverData ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const avgPrice = priceData && priceData.length > 0
    ? priceData.reduce((s, r) => s + r.price_per_kwh, 0) / priceData.length
    : 0.12
  const avgRenewable = priceData && priceData.length > 0
    ? priceData.reduce((s, r) => s + r.renewable_pct, 0) / priceData.length
    : 20

  const metrics = {
    period: { start: startDate, end: endDate },
    total_kwh: +totalKwh.toFixed(2),
    total_cost_usd: +(totalKwh * avgPrice).toFixed(2),
    total_co2_kg: +(totalKwh * co2Factor * (1 - avgRenewable / 100)).toFixed(2),
    avg_renewable_pct: +avgRenewable.toFixed(1),
    avg_price_per_kwh: +avgPrice.toFixed(4),
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: REPORT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(metrics) }],
  })

  const summary = message.content.find(b => b.type === 'text')?.text ?? ''
  return NextResponse.json({ summary, metrics })
}
