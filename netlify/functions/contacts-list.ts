// netlify/functions/contacts-list.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, supaHeaders, SUPABASE_URL } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || '').trim()

    if (!SUPABASE_URL) {
      return badRequest('Missing SUPABASE_URL in env')
    }

    // Base URL REST di Supabase
    const url = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
    url.searchParams.set('select', 'first_name,last_name,phone_e164')
    url.searchParams.set('order', 'last_name.asc,first_name.asc')
    url.searchParams.set('limit', '20')

    // Filtro di ricerca: usa correttamente or=(...)
    if (q.length >= 2) {
      const like = `*${q}*` // PostgREST accetta ilike.*q*
      url.searchParams.set(
        'or',
        `(first_name.ilike.${like},last_name.ilike.${like},phone_e164.ilike.${like})`
      )
    }

    const res = await fetch(url.toString(), {
      headers: supaHeaders(), // include apiKey: service role, preferProfile, ecc.
    })

    if (!res.ok) {
      const text = await res.text()
      return json({ error: text }, res.status)
    }

    const items = await res.json()
    return json({ items })
  } catch (err: any) {
    return json({ error: err?.message || String(err) }, 500)
  }
}
