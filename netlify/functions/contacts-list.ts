// netlify/functions/contacts-list.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, serverError, supaHeaders, SUPABASE_URL } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || '').trim()

    const url = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
    const params = url.searchParams
    params.set('select', 'id,first_name,last_name,phone_e164')
    params.set('order', 'last_name.asc,first_name.asc')
    params.set('limit', '200')

    if (q) {
      // ricerca semplice su nome/cognome/telefono
      params.set('or', `first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone_e164.ilike.*${q}*`)
    }

    const r = await fetch(url.toString(), { headers: supaHeaders() })
    if (!r.ok) return badRequest(await r.text())
    const data = await r.json()
    return json({ items: data })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
