import type { Handler } from '@netlify/functions'
import { supa, ok, badRequest, serverError } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return badRequest('Use POST')
    }

    const body = JSON.parse(event.body || '{}')
    const {
      dentist_id,
      chair,
      date,
      time,
      duration_min,
      contact_id,
      patient_name,
      phone_e164,
      note
    } = body

    // === VALIDAZIONI BASE ===
    if (!dentist_id || !chair || !date || !time) {
      return badRequest('Missing required fields: dentist_id, chair, date, time')
    }
    if (!phone_e164) {
      return badRequest('Missing patient phone number')
    }

    // Creiamo data/ora appuntamento in ISO
    const startIso = new Date(`${date}T${time}:00.000Z`).toISOString()

    // === CREA APPUNTAMENTO ===
    const { data: inserted, error } = await supa
      .from('appointments')
      .insert({
        dentist_id,
        chair,
        appointment_at: startIso,
        duration_min: duration_min || 30,
        contact_id: contact_id || null,
        patient_name: patient_name || null,
        phone_e164,
        note: note || null,
        status: 'booked',
        timezone: 'Europe/Rome',
        review_delay_hours: 2
      })
      .select()
      .maybeSingle()

    if (error || !inserted) {
      return serverError(error?.message || 'Insert failed')
    }

    const appt = inserted

    // === ENQUEUE REMINDERS IN scheduled_messages ===
    try {
      const apptTime = new Date(appt.appointment_at)

      const confirmBody =
        `✅ Appuntamento confermato per ${appt.patient_name || 'paziente'} ` +
        `il ${apptTime.toLocaleDateString('it-IT')} alle ${apptTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`

      const reminderBody =
        `⏰ Promemoria: appuntamento alle ${apptTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ` +
        `del ${apptTime.toLocaleDateString('it-IT')}.`

      const reviewBody =
        `🙏 Ciao ${appt.patient_name || ''}, com'è andata la visita? Se ti va, lasciaci una recensione: ${process.env.VITE_GOOGLE_REVIEW_LINK || ''}`

      const rows = [
        {
          contact_id: appt.contact_id,
          appointment_id: appt.id,
          phone_e164: appt.phone_e164,
          body: confirmBody,
          due_at: new Date().toISOString(),
          status: 'pending',
        },
        {
          contact_id: appt.contact_id,
          appointment_id: appt.id,
          phone_e164: appt.phone_e164,
          body: reminderBody,
          due_at: new Date(apptTime.getTime() - 3600_000).toISOString(), // 1h prima
          status: 'pending',
        },
        {
          contact_id: appt.contact_id,
          appointment_id: appt.id,
          phone_e164: appt.phone_e164,
          body: reviewBody,
          due_at: new Date(apptTime.getTime() + 7200_000).toISOString(), // 2h dopo
          status: 'pending',
        }
      ]

      const { error: qErr } = await supa.from('scheduled_messages').insert(rows)
      if (qErr) {
        console.warn('Failed to enqueue messages:', qErr.message)
      }
    } catch (e: any) {
      console.warn('Enqueue error:', e?.message || e)
    }

    return ok({ appointment: appt })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
