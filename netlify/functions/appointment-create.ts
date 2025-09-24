import type { Handler } from '@netlify/functions'
import { supa, ok, badRequest, serverError } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return badRequest('Use POST')

    const body = JSON.parse(event.body || '{}')
    const { dentist_id, chair, date, time, duration_min, contact_id, patient_name, phone_e164, note } = body

    if (!dentist_id || !chair || !date || !time) {
      return badRequest('Missing required fields')
    }

    const startIso = new Date(`${date}T${time}:00.000Z`).toISOString()

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

    if (error || !inserted) return serverError(error?.message || 'Insert failed')

    const appt = inserted

    // enqueue reminders: conferma, reminder -1h, review +2h
    try {
      const apptId = appt.id as string
      const apptDate = new Date(appt.appointment_at)

      const confirmMsg = `✅ Appuntamento confermato: ${appt.patient_name || 'Paziente'} alle ${apptDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} del ${apptDate.toLocaleDateString('it-IT')}.`
      const reminderMsg = `⏰ Promemoria: hai un appuntamento alle ${apptDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} di oggi. Ti aspettiamo!`
      const reviewMsg = `Ciao! Com'è andata la visita? Se ti va, lasciaci una recensione 🙏 ${process.env.VITE_GOOGLE_REVIEW_LINK || ''}`

      const rows = [
        {
          appointment_id: apptId,
          phone_e164: appt.phone_e164!,
          body: confirmMsg,
          due_at: new Date().toISOString(),
          status: 'pending',
        },
        {
          appointment_id: apptId,
          phone_e164: appt.phone_e164!,
          body: reminderMsg,
          due_at: new Date(apptDate.getTime() - 3600_000).toISOString(), // -1h
          status: 'pending',
        },
        {
          appointment_id: apptId,
          phone_e164: appt.phone_e164!,
          body: reviewMsg,
          due_at: new Date(apptDate.getTime() + 2*3600_000).toISOString(), // +2h
          status: 'pending',
        },
      ]

      await supa.from('scheduled_messages').insert(rows)
    } catch (e:any) {
      console.warn('Reminder enqueue failed:', e.message)
    }

    return ok({ appointment: appt })
  } catch (e:any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
