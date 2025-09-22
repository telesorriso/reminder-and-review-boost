// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  try {
    // 1) Parametri
    const date = (new URL(event.rawUrl).searchParams.get('date') || '').trim()
    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)
    console.log('PING appointments-by-day', { date })
    console.log('DEBUG RANGE', { start, end })

    // 2) Query a Supabase (appointments + relazione opzionale con contacts)
    const { data, error } = await supa
      .from('appointments')
      .select(`
        id,
        patient_name,
        phone_e164,
        appointment_at,
        duration_min,
        chair,
        status,
        contacts:contact_id ( first_name, last_name )
      `)
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (error) {
      console.error('SUPABASE ERROR', error)
      return serverError(error.message)
    }

    console.log('APPOINTMENTS RAW', data)

    // 3) Mappo la risposta (aggiungo anche i nomi dal contatto, se presenti)
    const appointments = (data || []).map((row: any) => ({
      id: row.id,
      patient_name: row.patient_name ?? null,
      phone_e164: row.phone_e164 ?? null,
      appointment_at: row.appointment_at, // UTC ISO nel DB
      duration_min: row.duration_min,
      chair: row.chair,
      status: row.status,
      contact_first_name: row.contacts?.first_name ?? null,
      contact_last_name: row.contacts?.last_name ?? null,
    }))

    console.log('APPOINTMENTS MAPPED', appointments)

    // 4) Risposta OK
    return ok({ appointments })
  } catch (e: any) {
    console.error('UNHANDLED ERROR', e)
    return serverError(e?.message || 'Unhandled error')
  }
}
