import type { Handler } from '@netlify/functions'
// Crea un appuntamento. Supporta:
// - { contact_id, date_local, time_local, chair, duration_min, review_delay_hours }
// - { patient_name, phone_e164, date_local, time_local, chair, duration_min, review_delay_hours }
// - opzionale: { save_contact: true } quando si inserisce manualmente
import {
  ok,
  badRequest,
  serverError,
  supa,
  romeToUtcISO,
  splitName,
  isUUID,
} from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return badRequest('Use POST')

    const body = JSON.parse(event.body || '{}') => ({}))
    const {
      contact_id,
      patient_name,
      phone_e164,
      date_local,
      time_local,
      chair,
      duration_min,
      review_delay_hours,
      save_contact,
    } = body || {}

    if (!date_local || !time_local) return badRequest('Missing date/time')
    if (!chair) return badRequest('Missing chair')
    if (!duration_min) return badRequest('Missing duration')

    // Calcolo istante appuntamento in UTC ISO
    const appointment_at = romeToUtcISO(String(date_local), String(time_local))

    let finalPatientName: string | null = (patient_name ?? '').trim() || null
    let finalContactId: string | null = contact_id ?? null
    let finalPhone: string | null = (phone_e164 ?? '').trim() || null

    // Se viene passato un contact_id, denormalizzo il nome per display
    if (finalContactId) {
      if (!isUUID(finalContactId)) return badRequest('Invalid contact_id')

      const { data: c, error: ce } = await supa
        .from('contacts')
        .select('first_name,last_name,phone_e164')
        .eq('id', finalContactId)
        .single()

      if (ce) return serverError(ce.message)

      const display =
        [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim()
      if (display) finalPatientName = display
      if (!finalPhone) finalPhone = c?.phone_e164 ?? null
    }

    // Se inserimento manuale + richiesta di salvataggio contatto
    if (!finalContactId && !finalPatientName && finalPhone) {
      // se non hai indicato explicit patient_name ma hai un telefono,
      // provo a derivare nome/cognome dal campo "patient_name" (anche vuoto)
      const { first, last } = splitName(patient_name || '')
      const toInsert = {
        first_name: first,
        last_name: last,
        phone_e164: finalPhone,
      }
      if (save_contact) {
        const { data: nc, error: ne } = await supa
          .from('contacts')
          .insert(toInsert)
          .select('id, first_name, last_name')
          .single()
        if (ne) return serverError(ne.message)
        finalContactId = nc.id
        if (!finalPatientName) {
          const nm = [nc.first_name, nc.last_name].filter(Boolean).join(' ').trim()
          if (nm) finalPatientName = nm
        }
      }
    }

    // Inserimento appuntamento
    const insertPayload: any = {
      appointment_at,
      chair,
      duration_min,
      status: 'scheduled',
      contact_id: finalContactId,
      patient_name: finalPatientName,
      phone_e164: finalPhone,
      review_delay_hours: review_delay_hours ?? 2,
    }

    const { data, error } = await supa
      .from('appointments')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) return serverError(error.message)

    return ok({ id: data?.id })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
