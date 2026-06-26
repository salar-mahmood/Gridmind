import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (!_instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
    }
    _instance = createClient(url, key, { auth: { persistSession: false } })
  }
  return _instance
}

// Lazy proxy — actual client is created on first property access, not at import time.
// This allows `next build` to succeed without env vars.
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
