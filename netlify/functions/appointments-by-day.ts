import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const date = (new URL(event.rawUrl).searchParams.get('date') || '').trim()
    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)

    const { data, error } = await supa
      .from('appointments')
      .select(`
        id, chair, appointment_at, duration_min, status, note,
        patient_name, phone_e164, contact_id,
        contacts:contact_id ( id, first_name, last_name, phone_e164 )
      `)
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (error) return serverError(error.message)

    const items = (data || []).map((row: any) => ({
      id: row.id,
      chair: row.chair,
      appointment_at: row.appointment_at,
      duration_min: row.duration_min,
      status: row.status,
      note: row.note ?? null,
      patient_name: row.patient_name ?? null,
      phone_e164: row.phone_e164 ?? null,
      contact_id: row.contact_id ?? null,
      contact: row.contacts
        ? {
            id: row.contacts.id,
            first_name: row.contacts.first_name ?? null,
            last_name: row.contacts.last_name ?? null,
            phone_e164: row.contacts.phone_e164 ?? null,
          }
        : null,
    }))

    return ok({ items })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
