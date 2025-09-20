// netlify/functions/appointments-create.ts
import { badRequest, json, serverError, SUPABASE_URL, supaHeaders, romeToUtcISO, splitName, isUUID } from './_shared'
import { DateTime } from 'luxon'

export default async (req: Request) => {
  try {
    if (req.method !== 'POST') return badRequest('Use POST')

    let body: any
    try {
      body = await req.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const {
      // sempre presenti
      date_local,            // "YYYY-MM-DD"
      time_local,            // "HH:mm"
      chair,                 // 1 | 2
      duration_min,          // number
      review_delay_hours,    // number (es. 2 o 24)

      // uno dei due rami:
      contact_id,            // UUID di contacts.id
      patient_name,          // quando inserito manualmente
      phone_e164,            // quando inserito manualmente (+39…)
      save_contact,          // boolean: se true, crea/aggiorna contatto
    } = body || {}

    // validazioni di base
    if (!date_local || !time_local) return badRequest('Missing date_local or time_local')
    if (!chair) return badRequest('Missing chair')
    const duration = Number(duration_min || 30)
    const reviewDelay = Number(review_delay_hours || 2)

    // calcolo istante UTC
    const appointment_at = romeToUtcISO(String(date_local), String(time_local))

    // ricava nome/telefono/contatto, gestendo i due rami
    let finalContactId: string | null = null
    let finalName = ''
    let finalPhone = ''

    if (contact_id) {
      if (!isUUID(String(contact_id))) return badRequest('contact_id must be a UUID')
      finalContactId = String(contact_id)
    } else {
      if (!patient_name || !phone_e164) return badRequest('Missing patient_name or phone_e164')
      finalName = String(patient_name).trim()
      finalPhone = String(phone_e164).trim()

      // se richiesto, salva/aggiorna il contatto (upsert su phone_e164)
      if (save_contact) {
        const { first_name, last_name } = splitName(finalName)
        const up = await fetch(`${SUPABASE_URL}/rest/v1/contacts?on_conflict=phone_e164`, {
          method: 'POST',
          headers: {
            ...supaHeaders(),
            Prefer: 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify([{ first_name, last_name, phone_e164: finalPhone }]),
        })
        if (!up.ok) {
          const t = await up.text()
          return serverError(new Error(`Failed upserting contact: ${t}`))
        }
        const rows = await up.json()
        if (rows && rows[0]?.id) finalContactId = rows[0].id
      }
    }

    // crea l'appuntamento
    const insertPayload: any = {
      chair,
      duration_min: duration,
      appointment_at,       // UTC timestamptz
      status: 'scheduled',
    }
    if (finalContactId) insertPayload.contact_id = finalContactId
    if (!finalContactId) {
      insertPayload.patient_name = finalName
      insertPayload.phone_e164 = finalPhone
    }

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: {
        ...supaHeaders(),
        Prefer: 'return=representation',
      },
      body: JSON.stringify([insertPayload]),
    })
    if (!ins.ok) {
      const t = await ins.text()
      return serverError(new Error(`Failed creating appointment: ${t}`))
    }
    const [appointment] = await ins.json()

    // (Opzionale) calcolo quando inviare review (se avete un job/cron che legge da appointments)
    // Non inseriamo righe in "messages": il vostro scheduler/cron può leggerle da "appointments".
    const summary = {
      appointment_id: appointment?.id,
      appointment_at,
      review_at: DateTime.fromISO(appointment_at).plus({ hours: reviewDelay }).toUTC().toISO(),
    }

    return json({ ok: true, appointment, summary })
  } catch (e) {
    return serverError(e)
  }
}
