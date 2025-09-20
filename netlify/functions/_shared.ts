// netlify/functions/_shared.ts
import { DateTime } from 'luxon'

export const SUPABASE_URL = process.env.SUPABASE_URL as string
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}

export function supaHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400)
}

export function serverError(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e)
  return json({ error: 'Unhandled error', details: msg }, 500)
}

/** Helper: YYYY-MM-DD + HH:mm (Europe/Rome) -> UTC ISO string */
export function romeToUtcISO(date_local: string, time_local: string) {
  const dt = DateTime.fromISO(`${date_local}T${time_local}`, { zone: 'Europe/Rome' })
  if (!dt.isValid) throw new Error('Invalid local date/time')
  return dt.toUTC().toISO()
}

/** Very light split: "Mario Rossi Bianchi" -> {first_name:"Mario Rossi", last_name:"Bianchi"} */
export function splitName(full: string) {
  const p = full.trim().split(/\s+/)
  if (p.length === 1) return { first_name: p[0], last_name: '' }
  return { first_name: p.slice(0, -1).join(' '), last_name: p[p.length - 1] }
}

/** Quick UUID check */
export function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
