export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  let query = supabaseServer.from('ai_recommendations').select('*').order('created_at', { ascending: false })

  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (data ?? []).sort((a, b) =>
    (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 4) -
    (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 4)
  )

  return NextResponse.json(sorted)
}
