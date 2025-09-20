// netlify/functions/_shared.ts
import { DateTime } from 'luxon'

export const SUPABASE_URL = process.env.SUPABASE_URL as string
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

export const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export const badRequest = (message: string) => json({ error: message }, 400)

export const serverError = (err: unknown) =>
  json(
    {
      error: 'Unhandled error',
      details:
        err instanceof Error ? err.message : typeof err === 'string' ? err : null,
    },
    500
  )

export const supaHeaders = () => ({
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

/** Utils esportati anche per appointments-create.ts */
export const TZ = 'Europe/Rome'

export function romeToUtcISO(dateLocal: string, timeLocal: string) {
  // dateLocal: "YYYY-MM-DD", timeLocal: "HH:mm"
  return DateTime.fromISO(`${dateLocal}T${timeLocal}`, { zone: TZ })
    .toUTC()
    .toISO()
}

export function isUUID(x: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    x || ''
  )
}

/** "Mario Rossi" -> { first_name: "Mario", last_name: "Rossi" } */
export function splitName(full: string) {
  const parts = (full || '').trim().split(/\s+/)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  const last_name = parts.pop() as string
  const first_name = parts.join(' ')
  return { first_name, last_name }
}
