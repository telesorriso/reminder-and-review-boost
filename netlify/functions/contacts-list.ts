// netlify/functions/contacts-list.ts
import { json, serverError, SUPABASE_URL, supaHeaders } from './_shared'

export default async (req: Request) => {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const limit = 2000

    let endpoint = `${SUPABASE_URL}/rest/v1/contacts?select=id,first_name,last_name,phone_e164&order=last_name.asc,first_name.asc&limit=${limit}`

    if (q) {
      const like = encodeURIComponent(`%${q}%`)
      const or = `first_name.ilike.${like},last_name.ilike.${like},phone_e164.ilike.${like}`
      endpoint += `&or=(${or})`
    }

    const res = await fetch(endpoint, { headers: supaHeaders() })
    if (!res.ok) return serverError(await res.text())
    const items = await res.json()

    return json({ items })
  } catch (e) {
    return serverError(e)
  }
}
