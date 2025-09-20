// netlify/functions/contacts-create.ts
import { SUPABASE_URL, supaHeaders, json, badRequest, serverError, splitName } from './_shared'

export default async (req: Request) => {
  try {
    if (req.method !== 'POST') return badRequest('Use POST')
    let payload: { full_name?: string; first_name?: string; last_name?: string; phone_e164?: string }
    try {
      payload = await req.json()
    } catch {
      return badRequest('Invalid JSON')
    }

    let { first_name, last_name, phone_e164, full_name } = payload
    if (full_name && (!first_name || !last_name)) {
      const s = splitName(full_name)
      first_name = first_name || s.first_name
      last_name = last_name || s.last_name
    }

    if (!first_name || !phone_e164) return badRequest('Missing first_name or phone_e164')

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: { ...supaHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ first_name, last_name: last_name ?? '', phone_e164 }]),
    })
    if (!res.ok) return serverError(await res.text())
    const [row] = await res.json()
    return json({ ok: true, contact: row })
  } catch (e) {
    return serverError(e)
  }
}
