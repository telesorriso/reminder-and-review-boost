import { createClient } from '@supabase/supabase-js'

export const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const ok = (body:any) => ({
  statusCode: 200,
  body: JSON.stringify(body)
})

export const badRequest = (msg:string) => ({
  statusCode: 400,
  body: JSON.stringify({ error: msg })
})

export const serverError = (msg:string) => ({
  statusCode: 500,
  body: JSON.stringify({ error: msg })
})
