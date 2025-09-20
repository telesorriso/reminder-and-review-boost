// netlify/functions/contacts-create.ts
import type { Handler } from '@netlify/functions'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const json = (body: any, status = 200) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const { first_name, last_name, phone_e164 } = JSON.parse(event.body || '{}') as {
      first_name?: string; last_name?: string; phone_e164?: string
    }

    if (!first_name || !phone_e164) {
      return json({ error: 'first_name e phone_e164 sono obbligatori' }, 400)
    }

    const payload = [{
      first_name: String(first_name).trim(),
      last_name: String(last_name || '').trim(),
      phone_e164: String(phone_e164).trim(),
    }]

    // Upsert su phone_e164 (UNIQUE). Se esiste, lo riusa e ritorna la riga.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      return json({ error: data?.message || 'Insert failed' }, 500)
    }

    const contact = Array.isArray(data) ? data[0] : data
    return json({ contact })
  } catch (err: any) {
    return json({ error: err?.message || 'Unexpected error' }, 500)
  }
}
