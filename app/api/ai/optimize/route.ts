import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { RecommendationsArraySchema } from '@/lib/validations'
import { SERVERS } from '@/lib/telemetry-sim'

const MOCK_RECOMMENDATIONS = [
  { type: 'cooling_adjustment', priority: 'high', description: 'rack-A servers are running at 72°C average — reduce CRAC setpoint by 2°C to prevent thermal throttling.', action: 'Set CRAC-1 setpoint from 22°C to 20°C', estimated_kwh_savings: 18.4, estimated_usd_savings: 2.21, confidence: 0.87 },
  { type: 'workload_shift', priority: 'medium', description: 'Energy prices drop to $0.062/kWh between 02:00–05:00. Shift 4 training jobs to this window for significant cost reduction.', action: 'Reschedule srv-03, srv-07 training workloads to 02:00–05:00', estimated_kwh_savings: 42.0, estimated_usd_savings: 5.04, confidence: 0.91 },
  { type: 'server_consolidation', priority: 'low', description: 'srv-12 and srv-15 are running at 8% CPU with idle workloads. Consolidate onto a single server to save power.', action: 'Migrate workloads from srv-15 to srv-12 and power down srv-15', estimated_kwh_savings: 9.6, estimated_usd_savings: 1.15, confidence: 0.74 },
  { type: 'cooling_adjustment', priority: 'medium', description: 'Renewable energy availability peaks at 68% between 11:00–14:00. Schedule high-compute jobs during this window to reduce carbon footprint.', action: 'Move inference batch jobs to 11:00–14:00 slot', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 0.82 },
  { type: 'alert', priority: 'critical', description: 'srv-04 power draw has exceeded 420W threshold for the past 3 ticks — potential hardware fault or runaway process.', action: 'Inspect srv-04 immediately and check for runaway processes', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 0.96 },
  { type: 'workload_shift', priority: 'high', description: 'PUE is currently 1.82 — above target of 1.5. Redistribute rack-D workloads to improve airflow and reduce cooling overhead.', action: 'Rebalance rack-D server loads to achieve ≤70% utilization', estimated_kwh_savings: 31.2, estimated_usd_savings: 3.74, confidence: 0.79 },
]

export async function POST() {
  try {
    // Fetch latest live row per server
    const serverRows = await Promise.all(
      SERVERS.map(({ id }) =>
        supabaseServer
          .from('server_telemetry')
          .select('*')
          .eq('server_id', id)
          .eq('is_scheduled', false)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()
          .then(r => r.data)
      )
    )

    const { data: cooling, error: coolingErr } = await supabaseServer
      .from('cooling_state')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(4)

    if (coolingErr) throw coolingErr

    const { data: price, error: priceErr } = await supabaseServer
      .from('energy_prices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (priceErr) throw priceErr

    const snapshot = {
      servers: serverRows.filter(Boolean),
      cooling: cooling ?? [],
      price,
      analyzed_at: new Date().toISOString(),
    }

    let recommendations: Array<{ type: string; priority: string; description: string; action: string; estimated_kwh_savings: number; estimated_usd_savings: number; confidence: number }>

    if (!process.env.ANTHROPIC_API_KEY) {
      recommendations = [...MOCK_RECOMMENDATIONS]
    } else {
      const { anthropic, MODEL, OPTIMIZATION_SYSTEM_PROMPT } = await import('@/lib/claude')
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: OPTIMIZATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
      })

      const text = message.content.find(b => b.type === 'text')?.text ?? ''
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch {
        return NextResponse.json({ error: 'Claude returned non-JSON', raw: text.slice(0, 500) }, { status: 422 })
      }
      const result = RecommendationsArraySchema.safeParse(parsed)
      if (!result.success) {
        return NextResponse.json({ error: 'Invalid AI response schema', details: result.error.format() }, { status: 422 })
      }
      recommendations = result.data
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from('ai_recommendations')
      .insert(recommendations)
      .select()

    if (insertErr) throw insertErr
    return NextResponse.json(inserted)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: String(err) }, { status })
  }
}
