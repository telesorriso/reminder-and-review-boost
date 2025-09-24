import { createClient } from '@supabase/supabase-js'

export const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const ok = (data: any) => ({
  statusCode: 200,
  body: JSON.stringify(data),
})

export const badRequest = (msg: string) => ({
  statusCode: 400,
  body: msg,
})

export const serverError = (msg: string) => ({
  statusCode: 500,
  body: msg,
})
