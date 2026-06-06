import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('energy_prices')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
