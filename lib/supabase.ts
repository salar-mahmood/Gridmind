import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (!_instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    _instance = createClient(url, key)
  }
  return _instance
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
