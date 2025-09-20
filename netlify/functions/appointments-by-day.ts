import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const date = (new URL(event.rawUrl).searchParams.get('date') || '').trim()
    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)

    // Query su appointments + relazione con contacts
    const { data, error } = await supa
      .from('appointments')
      .select(`
        id, patient_name, phone_e164, appointment_at, duration_min, chair, status,
        contacts:contact_id ( first_name, last_name )
      `)
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return serverError(error.message)
    }

    // Flatten dei dati
    const appointments = (data || []).map((row: any) => ({
      id: row.id,
      patient_name: row.patient_name ?? null,
      phone_e164: row.phone_e164 ?? null,
      appointment_at: row.appointment_at,
      duration_min: row.duration_min,
      chair: row.chair,
      status: row.status,
      contact_first_name: row.contacts?.first_name ?? null,
      contact_last_name: row.contacts?.last_name ?? null,
    }))

    return ok({ appointments })
  } catch (e: any) {
    console.error('Handler exception:', e)
    return serverError(e?.message || 'Unhandled error')
  }
}
