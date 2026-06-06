import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { anthropic, MODEL, OPTIMIZATION_SYSTEM_PROMPT } from '@/lib/claude'
import { RecommendationsArraySchema } from '@/lib/validations'
import { SERVERS } from '@/lib/telemetry-sim'

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

    const { data: cooling } = await supabaseServer
      .from('cooling_state')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(4)

    const { data: price } = await supabaseServer
      .from('energy_prices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    const snapshot = {
      servers: serverRows.filter(Boolean),
      cooling: cooling ?? [],
      price,
      analyzed_at: new Date().toISOString(),
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: OPTIMIZATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? ''

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'Claude returned non-JSON', raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    const result = RecommendationsArraySchema.safeParse(parsed)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid AI response schema', details: result.error.format(), raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from('ai_recommendations')
      .insert(result.data)
      .select()

    if (insertErr) throw insertErr
    return NextResponse.json(inserted)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: String(err) }, { status })
  }
}
