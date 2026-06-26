export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('cooling_state')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(4) // one per unit, most recent

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate: one row per unit_id
  const seen = new Set<string>()
  const latest = (data ?? []).filter(row => {
    if (seen.has(row.unit_id)) return false
    seen.add(row.unit_id)
    return true
  })

  return NextResponse.json(latest)
}
