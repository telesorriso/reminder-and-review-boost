// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

export const handler: Handler = async (event) => {
  try {
    const date = (new URL(event.rawUrl).searchParams.get('date') || '').trim()
    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)

    // 1) Prendo solo gli appuntamenti (senza join)
    const { data: appts, error: apptsErr } = await supa
      .from('appointments')
      .select('id, patient_name, phone_e164, appointment_at, duration_min, chair, status, contact_id')
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (apptsErr) {
      console.error('appointments error:', apptsErr)
      return serverError(apptsErr.message)
    }

    // 2) Raccolgo gli id contatti presenti
    const contactIds = Array.from(
      new Set((appts || []).map(a => a.contact_id).filter(Boolean))
    ) as string[]

    // 3) Faccio una in() sui contatti (solo se ce ne sono)
    let contactsById: Record<string, { first_name: string | null, last_name: string | null }> = {}
    if (contactIds.length) {
      const { data: contacts, error: contactsErr } = await supa
        .from('contacts')
        .select('id, first_name, last_name')
        .in('id', contactIds)

      if (contactsErr) {
        console.error('contacts error:', contactsErr)
        return serverError(contactsErr.message)
      }

      contactsById = Object.fromEntries(
        (contacts || []).map(c => [
          c.id,
          { first_name: c.first_name ?? null, last_name: c.last_name ?? null }
        ])
      )
    }

    // 4) Output finale appiattito
    const appointments = (appts || []).map((a: any) => {
      const c = a.contact_id ? contactsById[a.contact_id] : undefined
      return {
        id: a.id,
        patient_name: a.patient_name ?? null,
        phone_e164: a.phone_e164 ?? null,
        appointment_at: a.appointment_at,
        duration_min: a.duration_min,
        chair: a.chair,
        status: a.status,
        contact_first_name: c?.first_name ?? null,
        contact_last_name: c?.last_name ?? null,
      }
    })

    return ok({ appointments })
  } catch (e: any) {
    console.error('Handler exception:', e)
    return serverError(e?.message || 'Unhandled error')
  }
}
