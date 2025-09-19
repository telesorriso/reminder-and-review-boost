// netlify/functions/_shared.ts
export function json(body: unknown, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function badRequest(message = 'Bad request') {
  return json({ error: message }, 400)
}

export function serverError(message = 'Server error') {
  return json({ error: message }, 500)
}

export function supaHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL
  if (!key || !url) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in env')
  }
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export const SUPABASE_URL = process.env.SUPABASE_URL!
