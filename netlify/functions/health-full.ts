// netlify/functions/health-full.ts
import type { Handler } from '@netlify/functions'
import { json, serverError, supa, SUPABASE_URL, romeDayRangeUTC } from './_shared'

type Check = { name: string; ok: boolean; details?: any }

export const handler: Handler = async (event) => {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, details?: any) => checks.push({ name, ok, details })

  try {
    // 0) ENV
    const hasEnv = !!SUPABASE_URL
    add('env', hasEnv, { SUPABASE_URL_present: !!SUPABASE_URL })
    if (!hasEnv) return serverError('Missing env SUPABASE_URL')

    // 1) Contacts count
    try {
      const { error, count } = await supa.from('contacts').select('id', { count: 'exact', head: true })
      add('contacts_count', !error, { count, error: error?.message })
    } catch (e: any) {
      add('contacts_count', false, { error: e?.message || String(e) })
    }

    // 2) Appointments today (Rome day window)
    try {
      const today = new Date().toISOString().slice(0,10) // YYYY-MM-DD (UTC)
      const { start, end } = romeDayRangeUTC(today)
      const { data, error } = await supa
        .from('appointments')
        .select('id, start_at, duration_min, patient_name, chair')
        .gte('start_at', start)
        .lt('start_at', end)
        .limit(3)
      add('appointments_today', !error, { sample: data?.length ?? 0, error: error?.message })
    } catch (e: any) {
      add('appointments_today', false, { error: e?.message || String(e) })
    }

    // 3) Messages count (pending/recent)
    try {
      const { error, count } = await supa
        .from('messages')
        .select('id', { count: 'exact', head: true })
      add('messages_count', !error, { count, error: error?.message })
    } catch (e: any) {
      add('messages_count', false, { error: e?.message || String(e) })
    }

    const ok = checks.every(c => c.ok)
    return json({ ok, supabase_url: SUPABASE_URL, checks })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
