import type { Handler } from '@netlify/functions'
import { supa, ok, badRequest, serverError } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return badRequest('Use POST')
    }

    const body = JSON.parse(event.body || '{}')
    const { dentist_id, chair, date, time, duration_min, contact_id, patient_name, phone_e164, note } = body

    if (!dentist_id || !chair || !date || !time) {
      return badRequest('Missing required fields')
    }

    // Costruisci ISO per l’inizio appuntamento
    const startIso = new Date(`${date}T${time}:00.000Z`).toISOString()

    // === CREA APPUNTAMENTO ===
    const { data: inserted, error } = await supa
      .from('appointments')
      .insert({
        dentist_id,
        chair,
        start_at: startIso,                // ✅ colonna corretta
        duration_min: duration_min || 30,
        contact_id: contact_id || null,
        patient_name: patient_name || null,
        phone_e164: phone_e164 || null,
        note: note || null,
        status: 'booked',
      })
      .select()
      .maybeSingle()

    if (error || !inserted) {
      return serverError(error?.message || 'Insert failed')
    }

    // ✅ Non serve più inserire reminders qui.
    // Li creerà Supabase tramite il trigger sul table appointments.

    return ok({ appointment: inserted })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
