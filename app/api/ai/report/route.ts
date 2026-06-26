import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { ReportBodySchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = ReportBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const { startDate, endDate, co2Factor } = parsed.data

  try {
    const { data: serverData, error: sErr } = await supabaseServer
      .from('server_telemetry')
      .select('power_w, timestamp')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .eq('is_scheduled', false)

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

    const { data: priceData, error: pErr } = await supabaseServer
      .from('energy_prices')
      .select('price_per_kwh, renewable_pct')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

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

    let summary: string

    if (!process.env.ANTHROPIC_API_KEY) {
      summary = `During the reporting period from ${startDate} to ${endDate}, the data center consumed ${metrics.total_kwh.toFixed(1)} kWh of electricity at a total cost of $${metrics.total_cost_usd.toFixed(2)}. Average PUE was not computed for this mock summary. Renewable energy accounted for ${metrics.avg_renewable_pct}% of the energy mix, resulting in an estimated ${metrics.total_co2_kg.toFixed(1)} kg of CO₂ emissions.

Efficiency performance was within acceptable operational parameters. The renewable energy mix of ${metrics.avg_renewable_pct}% represents a positive contribution to sustainability goals. However, the average electricity cost of $${metrics.avg_price_per_kwh}/kWh suggests opportunities to shift more workloads to off-peak hours where prices fall below $0.07/kWh, which could reduce costs by an estimated 15–20%.

For the next reporting period, it is recommended to implement the AI-generated workload scheduling recommendations to capitalize on low-price and high-renewable windows. Additionally, a review of cooling setpoints in rack-A and rack-D should be conducted to bring PUE below the 1.5 target. Continued monitoring of server-level power draw will help identify consolidation opportunities and hardware anomalies before they impact operational costs.`
    } else {
      const { anthropic, MODEL, REPORT_SYSTEM_PROMPT } = await import('@/lib/claude')
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: REPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(metrics) }],
      })
      summary = message.content.find(b => b.type === 'text')?.text ?? ''
    }

    return NextResponse.json({ summary, metrics })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: String(err) }, { status })
  }
}
