// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const date =
      (event.queryStringParameters?.date ||
        new URL(event.rawUrl).searchParams.get('date') ||
        '').trim()

    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)

    // STEP 1: prendo gli appuntamenti del giorno (in UTC window) includendo contact_id
    const { data: appts, error: apptsErr } = await supa
      .from('appointments')
      .select('id, patient_name, phone_e164, appointment_at, duration_min, chair, status, contact_id')
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (apptsErr) return serverError(`STEP1 appointments error: ${apptsErr.message}`)

    // STEP 2: se ci sono contact_id, prendo i contatti in un colpo
    const contactIds = Array.from(
      new Set((appts || []).map(a => a.contact_id).filter(Boolean) as string[])
    )

    let contactMap = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (contactIds.length > 0) {
      const { data: contacts, error: contactsErr } = await supa
        .from('contacts')
        .select('id, first_name, last_name')
        .in('id', contactIds)

      if (contactsErr) return serverError(`STEP2 contacts error: ${contactsErr.message}`)

      for (const c of contacts || []) {
        contactMap.set(c.id, { first_name: c.first_name ?? null, last_name: c.last_name ?? null })
      }
    }

    // STEP 3: appiattisco i dati per il frontend
    const appointments = (appts || []).map(row => ({
      id: row.id,
      patient_name: row.patient_name ?? null,
      phone_e164: row.phone_e164 ?? null,
      appointment_at: row.appointment_at,
      duration_min: row.duration_min,
      chair: row.chair,
      status: row.status,
      contact_first_name: contactMap.get(row.contact_id || '')?.first_name ?? null,
      contact_last_name: contactMap.get(row.contact_id || '')?.last_name ?? null,
    }))

    return ok({ appointments })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
