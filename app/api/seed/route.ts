import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { generateTick } from '@/lib/telemetry-sim'

const CHUNK_SIZE = 200 // ticks per batch
const DAYS = 7
const INTERVAL_SECONDS = 30

export async function POST() {
  // Check if already seeded
  const { count } = await supabaseServer
    .from('server_telemetry')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: true, existing: count })
  }

  const now = Date.now()
  const totalTicks = (DAYS * 24 * 3600) / INTERVAL_SECONDS
  let seeded = 0

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = totalTicks - 1; i >= 0; i -= CHUNK_SIZE) {
        const chunkTicks = []
        for (let j = Math.min(CHUNK_SIZE - 1, i); j >= 0 && chunkTicks.length < CHUNK_SIZE; j--) {
          const at: Date = new Date(now - (i - (CHUNK_SIZE - 1 - chunkTicks.length)) * INTERVAL_SECONDS * 1000)
          chunkTicks.push(generateTick(at))
        }

        const serverRows = chunkTicks.flatMap(t => t.servers)
        const coolingRows = chunkTicks.flatMap(t => t.cooling)
        const priceRows = chunkTicks.map(t => t.price)

        const { error: sErr } = await supabaseServer.from('server_telemetry').insert(serverRows)
        if (sErr) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: sErr.message }) + '\n'))
          controller.close()
          return
        }
        await supabaseServer.from('cooling_state').insert(coolingRows)
        await supabaseServer.from('energy_prices').insert(priceRows)

        seeded += chunkTicks.length
        controller.enqueue(encoder.encode(
          JSON.stringify({ progress: seeded, total: totalTicks }) + '\n'
        ))
      }

      controller.enqueue(encoder.encode(
        JSON.stringify({ done: true, seeded }) + '\n'
      ))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
