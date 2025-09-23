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
        phone_e164: phone_e164 || null,
        note: note || null,
        status: 'booked',
      })
      .select()
      .maybeSingle()

    if (error || !inserted) {
      return serverError(error?.message || 'Insert failed')
    }

    const appt = inserted

    // === ENQUEUE REMINDERS ===
    try {
      const apptId = appt.id as string
      const confirmBody =
        `✅ Appuntamento confermato: ${appt.patient_name || 'Paziente'} ` +
        `alle ${new Date(appt.appointment_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ` +
        `del ${new Date(appt.appointment_at).toLocaleDateString('it-IT')}. A presto!`

      const delayHours = Number((body as any).review_delay_hours ?? 2)
      const reviewWhen = new Date(new Date(appt.appointment_at).getTime() + delayHours * 3600_000).toISOString()
      const reviewBody =
        `Ciao! Com'è andata la visita? Se ti va, lasciaci una recensione 🙏 ` +
        `${process.env.VITE_GOOGLE_REVIEW_LINK || ''}`

      const rows = [
        {
          contact_id: appt.contact_id,
          appointment_id: apptId,
          phone_e164: appt.phone_e164!,
          body: confirmBody,
          due_at: new Date().toISOString(),
          status: 'pending',
        },
        {
          contact_id: appt.contact_id,
          appointment_id: apptId,
          phone_e164: appt.phone_e164!,
          body: reviewBody,
          due_at: reviewWhen,
          status: 'pending',
        },
      ]

      const { error: qErr } = await supa.from('scheduled_messages').insert(rows)
      if (qErr) console.warn('Failed to enqueue messages:', qErr.message)
    } catch (e: any) {
      console.warn('Enqueue error:', e?.message || e)
    }

    return ok({ appointment: appt })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
