
import type { Handler } from '@netlify/functions'
import { checkAuth, requireEnv } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (!checkAuth(event.headers)) return { statusCode: 401, body: 'Unauthorized' }
    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const url = new URL(`${SUPABASE_URL}/rest/v1/messages`)
    url.searchParams.set('select', 'id,appointment_id,type,scheduled_at,sent_at,status,last_error')
    url.searchParams.set('order', 'scheduled_at.desc')
    url.searchParams.set('limit', '200')

    const res = await fetch(url.toString(), {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    })
    if (!res.ok) return { statusCode: 500, body: await res.text() }
    const rows = await res.json()
    return { statusCode: 200, body: JSON.stringify({ messages: rows }) }
  } catch (e: any) {
    return { statusCode: 500, body: e.message || 'Internal error' }
  }
}
