export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  let query = supabaseServer.from('alerts').select('*').order('created_at', { ascending: false })

  const severity = searchParams.get('severity')
  const type = searchParams.get('type')
  const resolved = searchParams.get('resolved')

  if (severity) query = query.eq('severity', severity)
  if (type) query = query.eq('type', type)
  if (resolved !== null) query = query.eq('resolved', resolved === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
