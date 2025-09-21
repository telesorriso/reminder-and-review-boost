// netlify/functions/messages-list.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, serverError, supaHeaders, SUPABASE_URL } from './_shared'

export const handler: Handler = async () => {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/messages`)
    const p = url.searchParams
    p.set('select', 'id,appointment_id,type,scheduled_at,sent_at,status,last_error')
    p.set('order', 'scheduled_at.desc')
    p.set('limit', '200')

    const r = await fetch(url.toString(), { headers: supaHeaders() })
    if (!r.ok) return badRequest(await r.text())
    const data = await r.json()
    return json({ items: data })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
