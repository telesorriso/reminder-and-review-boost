// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  // Log di debug per vedere sempre cosa arriva e quali env abbiamo
  try {
    const date =
      event.queryStringParameters?.date?.trim() ||
      (event as any)?.rawQuery?.match?.(/date=([^&]+)/)?.[1] ||
      ''

    if (!date) {
      console.error('BAD_REQUEST: missing ?date=YYYY-MM-DD')
      return badRequest('Missing ?date=YYYY-MM-DD')
    }

    const { start, end } = romeDayRangeUTC(date)
    console.info('FETCH_RANGE', { start, end })

    // Query con join sulla tabella contacts (via FK contact_id)
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
      console.error('SUPABASE_ERROR', error)
      return serverError(error.message)
    }

    // Mapping “safe”: se il DB ha ancora stringhe tipo "{contact...}"
    // le ignoriamo e mostriamo null (verranno rimpiazzate dal nome contatto lato UI)
    const sanitizePatient = (p: any) => {
      const v = (p ?? '').toString().trim()
      return v.startsWith('{contact.') ? null : (v || null)
    }

    const appointments = (data || []).map((row: any) => ({
      id: row.id,
      patient_name: sanitizePatient(row.patient_name),
      phone_e164: row.phone_e164 ?? null,
      appointment_at: row.appointment_at,    // UTC ISO
      duration_min: row.duration_min,
      chair: row.chair,
      status: row.status,
      contact_first_name: row.contacts?.first_name ?? null,
      contact_last_name: row.contacts?.last_name ?? null,
    }))

    console.info('APPTS_COUNT', appointments.length)
    return ok({ appointments })
  } catch (e: any) {
    // Qualsiasi eccezione non gestita: log + Response valida
    console.error('UNHANDLED', e?.message || e)
    return serverError(e?.message || 'Unhandled error')
  }
}
