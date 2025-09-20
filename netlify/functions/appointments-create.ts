// netlify/functions/appointments-create.ts
import {
  SUPABASE_URL,
  supaHeaders,
  json,
  badRequest,
  serverError,
  romeToUtcISO,
  splitName,
  isUUID,
} from './_shared'

type Body = {
  // passati dal frontend
  date_local: string
  time_local: string
  chair: number
  duration_min: number
  review_delay_hours?: number

  // modalità A: uso contatto esistente
  contact_id?: string

  // modalità B: inserimento manuale
  patient_name?: string
  phone_e164?: string

  // opzionale: se true e non esiste contatto, crealo
  save_contact?: boolean
}

export default async (req: Request) => {
  try {
    if (req.method !== 'POST') return badRequest('Use POST')

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return badRequest('Invalid JSON')
    }

    const {
      date_local,
      time_local,
      chair,
      duration_min,
      review_delay_hours,
      contact_id,
      patient_name,
      phone_e164,
      save_contact,
    } = body

    if (!date_local || !time_local) return badRequest('Missing date_local/time_local')
    if (!chair) return badRequest('Missing chair')
    if (!duration_min) return badRequest('Missing duration_min')

    let finalContactId: string | null = null
    let finalName = patient_name || ''
    let finalPhone = phone_e164 || ''

    // Se ho contact_id lo uso.
    if (contact_id) {
      if (!isUUID(contact_id)) return badRequest('contact_id must be a UUID')
      finalContactId = contact_id
    } else {
      // Inserimento manuale: servono nome e telefono
      if (!finalName || !finalPhone) return badRequest('Missing patient_name or phone_e164')

      if (save_contact) {
        // creo/aggiorno contatto (upsert su phone_e164)
        const { first_name, last_name } = splitName(finalName)
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
          method: 'POST',
          headers: { ...supaHeaders(), Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify([{ first_name, last_name, phone_e164: finalPhone }]),
        })
        if (!upsertRes.ok) return serverError(await upsertRes.text())
        const [ins] = await upsertRes.json()
        finalContactId = ins?.id ?? null
      }
    }

    const appointment_at = romeToUtcISO(date_local, time_local)

    // Inserisco l’appuntamento
    const insertPayload: any = [
      {
        appointment_at,
        chair,
        duration_min,
        status: 'scheduled',
        review_delay_hours: review_delay_hours ?? 2,
        contact_id: finalContactId,
        // fallback se non c'è contact_id
        patient_name: finalContactId ? null : finalName,
        phone_e164: finalContactId ? null : finalPhone,
      },
    ]

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify(insertPayload),
    })
    if (!insRes.ok) return serverError(await insRes.text())
    const [row] = await insRes.json()

    return json({ ok: true, appointment: row })
  } catch (e) {
    return serverError(e)
  }
}
