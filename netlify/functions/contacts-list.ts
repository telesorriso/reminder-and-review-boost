
import type { Handler } from '@netlify/functions'
import { checkAuth, requireEnv } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (!checkAuth(event.headers)) return { statusCode: 401, body: 'Unauthorized' }
    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const search = (event.queryStringParameters || {})['q'] || ''
    const url = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
    url.searchParams.set('select', 'id,first_name,last_name,phone_e164')
    if (search) {
      url.searchParams.set('or', `(first_name.ilike.*${search}*,last_name.ilike.*${search}*,phone_e164.ilike.*${search}*)`)
    }
    url.searchParams.set('order', 'last_name.asc')

    const res = await fetch(url.toString(), {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    })
    if (!res.ok) return { statusCode: 500, body: await res.text() }
    const rows = await res.json()
    return { statusCode: 200, body: JSON.stringify({ contacts: rows }) }
  } catch (e: any) {
    return { statusCode: 500, body: e.message || 'Internal error' }
  }
}
