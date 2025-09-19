// netlify/functions/appointments-create.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, serverError, supaHeaders, SUPABASE_URL } from './_shared'

/**
 * Body JSON atteso:
 * {
 *   "contact_id": "<opzionale>",
 *   "patient_name": "Nome Cognome"  // se non passi contact_id
 *   "phone_e164": "+39....",        // se non passi contact_id
 *   "appointment_at": "2025-09-19T15:30:00.000Z", // ISO UTC
 *   "duration_min": 30,
 *   "chair": 1
 * }
 * Crea l'appuntamento e 3 messaggi: day-before, same-day, review (2h dopo).
 */
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return badRequest('POST only')
    if (!event.body) return badRequest('Missing body')

    const body = JSON.parse(event.body)

    // Se passa contact_id, leggi i dati del contatto
    if (body.contact_id && (!body.patient_name || !body.phone_e164)) {
      const cu = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
      cu.searchParams.set('id', `eq.${body.contact_id}`)
      cu.searchParams.set('select', 'first_name,last_name,phone_e164')
      const cr = await fetch(cu.toString(), { headers: supaHeaders() })
      if (!cr.ok) return badRequest(await cr.text())
      const [c] = await cr.json()
      if (!c) return badRequest('Contact not found')
      body.patient_name = `${c.first_name} ${c.last_name}`.trim()
      body.phone_e164 = c.phone_e164
    }

    const required = ['patient_name', 'phone_e164', 'appointment_at', 'duration_min', 'chair']
    for (const k of required) {
      if (!body[k]) return badRequest(`Missing ${k}`)
    }

    // Inserisci appuntamento
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({
        patient_name: body.patient_name,
        phone_e164: body.phone_e164,
        appointment_at: body.appointment_at, // deve essere UTC
        duration_min: body.duration_min,
        chair: body.chair,
        status: 'scheduled'
      })
    })
    if (!ar.ok) return badRequest(await ar.text())
    const [appt] = await ar.json()

    // Crea i 3 messaggi programmati
    const apptAt = new Date(body.appointment_at) // UTC
    const sameDayAt = new Date(apptAt)           // 2 ore prima dell'orario
    sameDayAt.setHours(sameDayAt.getHours() - 2)

    const dayBeforeAt = new Date(apptAt)
    dayBeforeAt.setDate(dayBeforeAt.getDate() - 1)
    dayBeforeAt.setHours(9, 0, 0, 0) // 09:00 del giorno prima

    const reviewAt = new Date(apptAt)
    reviewAt.setHours(reviewAt.getHours() + 2) // 2 ore dopo

    const messages = [
      { appointment_id: appt.id, type: 'reminder_day_before', scheduled_at: dayBeforeAt.toISOString(), status: 'pending' },
      { appointment_id: appt.id, type: 'reminder_same_day',  scheduled_at: sameDayAt.toISOString(),  status: 'pending' },
      { appointment_id: appt.id, type: 'review',              scheduled_at: reviewAt.toISOString(),   status: 'pending' }
    ]

    const mr = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify(messages)
    })
    if (!mr.ok) return badRequest(await mr.text())

    return json({ ok: true, appointment: appt })
  } catch (e: any) {
    return serverError(e?.message || String(e))
  }
}
