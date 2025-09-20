// netlify/functions/_shared.ts
export const SUPABASE_URL = process.env.SUPABASE_URL as string
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

export const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })

export const badRequest = (message: string) =>
  json({ error: message }, 400)

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
