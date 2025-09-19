
import type { Handler } from '@netlify/functions'
import { DateTime } from 'luxon'
import { checkAuth, requireEnv, TZ } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (!checkAuth(event.headers)) return { statusCode: 401, body: 'Unauthorized' }
    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const { date } = event.queryStringParameters || {}
    if (!date) return { statusCode: 400, body: 'Missing date param YYYY-MM-DD' }

    const startUTC = DateTime.fromISO(date, { zone: TZ }).startOf('day').toUTC().toISO()
    const endUTC = DateTime.fromISO(date, { zone: TZ }).endOf('day').toUTC().toISO()

    const url = new URL(`${SUPABASE_URL}/rest/v1/appointments`)
    url.searchParams.set('select', 'id,patient_name,phone_e164,appointment_at,duration_min,chair,status')
    url.searchParams.set('appointment_at', f'gte.{startUTC}')
    url.searchParams.append('appointment_at', f'lte.{endUTC}')
    url.searchParams.set('order', 'appointment_at.asc')

    const res = await fetch(url.toString(), {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    })
    if (!res.ok) return { statusCode: 500, body: await res.text() }
    const rows = await res.json()
    return { statusCode: 200, body: JSON.stringify({ appointments: rows }) }
  } catch (e: any) {
    return { statusCode: 500, body: e.message || 'Internal error' }
  }
}
