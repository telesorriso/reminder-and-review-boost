// netlify/functions/appointments-by-day.ts
import type { Handler } from '@netlify/functions'
import { ok, badRequest, serverError, romeDayRangeUTC, supa } from './_shared'

function getQueryDate(event: any): string {
  try {
    if (event?.rawUrl) {
      const d = new URL(event.rawUrl).searchParams.get('date')
      if (d) return d.trim()
    }
  } catch {}
  return String(event?.queryStringParameters?.date ?? '').trim()
}

export const handler: Handler = async (event) => {
  // NB: catturo *tutto* qui per evitare 502
  try {
    const date = getQueryDate(event)
    if (!date) return badRequest('Missing ?date=YYYY-MM-DD')

    const { start, end } = romeDayRangeUTC(date)

    // --- STEP 1: appuntamenti del giorno (mi porto dietro contact_id)
    let appts: any[] = []
    {
      const { data, error } = await supa
        .from('appointments')
        .select('id, patient_name, phone_e164, appointment_at, duration_min, chair, status, contact_id')
        .gte('appointment_at', start)
        .lt('appointment_at', end)
        .order('appointment_at', { ascending: true })

      if (error) {
        console.error('appointments-by-day STEP1 error:', error)
        // restituisco comunque una risposta valida per evitare 502
        return serverError(`STEP1: ${error.message}`)
      }
      appts = data ?? []
    }

    // --- STEP 2: se ci sono contact_id, prendo i contatti in un colpo
    const contactIds = Array.from(new Set(appts.map(a => a.contact_id).filter(Boolean) as string[]))
    const contactMap = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (contactIds.length > 0) {
      const { data: contacts, error } = await supa
        .from('contacts')
        .select('id, first_name, last_name')
        .in('id', contactIds)

      if (error) {
        console.error('appointments-by-day STEP2 error:', error)
        return serverError(`STEP2: ${error.message}`)
      }
      for (const c of contacts ?? []) {
        contactMap.set(c.id, { first_name: c.first_name ?? null, last_name: c.last_name ?? null })
      }
    }

    // --- OUTPUT PIATTO con contact_first_name/last_name
    const appointments = appts.map(row => {
      const names = row.contact_id ? contactMap.get(row.contact_id) : undefined
      return {
        id: row.id,
        patient_name: row.patient_name ?? null,
        phone_e164: row.phone_e164 ?? null,
        appointment_at: row.appointment_at,
        duration_min: row.duration_min,
        chair: row.chair,
        status: row.status,
        contact_first_name: names?.first_name ?? null,
        contact_last_name: names?.last_name ?? null,
      }
    })

    return ok({ appointments })
  } catch (e: any) {
    console.error('appointments-by-day FATAL:', e)
    return serverError(e?.message || 'Unhandled error')
  }
}
