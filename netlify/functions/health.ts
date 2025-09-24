// netlify/functions/health.ts
import type { Handler } from '@netlify/functions'
import { json, serverError, supa, SUPABASE_URL } from './_shared'

export const handler: Handler = async () => {
  try {
    // quick ping + minimal query to verify connectivity and perms
    const { data, error, count } = await supa
      .from('contacts')
      .select('id', { count: 'exact', head: true })
    if (error) {
      return serverError(`Supabase error: ${error.message}`)
    }
    return json({ ok: true, supabase_url: SUPABASE_URL, contacts_count: count ?? 0 })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
