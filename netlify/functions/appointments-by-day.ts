// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, serverError, supaHeaders, SUPABASE_URL } from './_shared'

/**
 * Query: ?date=YYYY-MM-DD
 * Ritorna gli appuntamenti del giorno (UTC) per disegnarli nell'agenda.
 */
export const handler: Handler = async (event) => {
  try {
    const date = event.queryStringParameters?.date
    if (!date) return badRequest('Missing date')

    // intervallo UTC del giorno
    const startUTC = `${date}T00:00:00.000Z`
    const endUTC = `${date}T23:59:59.999Z`

    const url = new URL(`${SUPABASE_URL}/rest/v1/appointments`)
    const params = url.searchParams
    params.set('select', 'id,patient_name,phone_e164,appointment_at,duration_min,chair,status')
    params.set('appointment_at', `gte.${startUTC}`)
    params.append('appointment_at', `lte.${endUTC}`)
    params.set('order', 'appointment_at.asc')

    const r = await fetch(url.toString(), { headers: supaHeaders() })
    if (!r.ok) return badRequest(await r.text())
    const data = await r.json()

    return json({ items: data })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
