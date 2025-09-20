// netlify/functions/contacts-list.ts
import type { Handler } from '@netlify/functions'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// blocco di paginazione (coerente con "Max rows" di Supabase; 1000 è sicuro)
const PAGE_SIZE = 1000

const handler: Handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in env' }),
      }
    }

    const q = (event.queryStringParameters?.q || '').trim()

    const all: any[] = []
    let offset = 0

    while (true) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
      url.searchParams.set('select', 'first_name,last_name,phone_e164')
      url.searchParams.set('order', 'last_name.asc,first_name.asc')
      url.searchParams.set('limit', String(PAGE_SIZE))
      url.searchParams.set('offset', String(offset))
      if (q.length >= 2) {
        url.searchParams.set(
          'or',
          `first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone_e164.ilike.*${q}*`
        )
      }

      const res = await fetch(url.toString(), {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'count=exact',
        },
      })

      if (!res.ok) {
        const text = await res.text()
        return { statusCode: 500, body: JSON.stringify({ error: text }) }
      }

      const items = await res.json()
      all.push(...items)

      // se la pagina ricevuta è più piccola del PAGE_SIZE, abbiamo finito
      if (items.length < PAGE_SIZE) break

      offset += PAGE_SIZE
    }

    return { statusCode: 200, body: JSON.stringify({ items: all }) }
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || String(e) }) }
  }
}

export { handler }
