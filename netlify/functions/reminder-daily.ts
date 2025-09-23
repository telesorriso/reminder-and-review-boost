// netlify/functions/reminders-daily.ts
import type { Handler } from '@netlify/functions'
import { DateTime } from 'luxon'
import { supa, ok, serverError, romeDayRangeUTC } from './_shared'

/**
 * Esegue ogni giorno alle 19:00 (Europe/Rome):
 *  - legge gli appuntamenti di DOMANI
 *  - per ciascuno crea (se non già presente) un reminder "day-before-19" con due_at = now()
 */
export const handler: Handler = async () => {
  try {
    const TZ = 'Europe/Rome'
    const nowRome = DateTime.now().setZone(TZ)
    const tomorrowISO = nowRome.plus({ days: 1 }).toISODate()!  // YYYY-MM-DD

    const { start, end } = romeDayRangeUTC(tomorrowISO)

    // 1) prendo gli appuntamenti di domani (status utili)
    const { data: appts, error: apptsErr } = await supa
      .from('appointments')
      .select(`
        id, appointment_at, duration_min, chair, status,
        patient_name, phone_e164, contact_id,
        contact:contact_id ( first_name, last_name, phone_e164 )
      `)
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .in('status', ['scheduled','booked'])

    if (apptsErr) return serverError(apptsErr.message)

    // 2) per evitare duplicati: leggo eventuali reminder già creati per questi appuntamenti
    const ids = (appts ?? []).map(a => a.id)
    let already: string[] = []
    if (ids.length) {
      const { data: rems, error: remsErr } = await supa
        .from('reminders')
        .select('appointment_id')
        .in('appointment_id', ids)
        .eq('kind', 'day-before-19')

      if (remsErr) return serverError(remsErr.message)
      already = (rems ?? []).map(r => r.appointment_id)
    }

    // 3) preparo le righe da inserire
    const toInsert: any[] = []
    for (const a of appts ?? []) {
      if (already.includes(a.id)) continue

      const phone: string | null =
        a.phone_e164 || a?.contact?.phone_e164 || null
      if (!phone) continue

      const timeRome = DateTime.fromISO(a.appointment_at).setZone(TZ).toFormat('HH:mm')
      const name = [a?.contact?.last_name, a?.contact?.first_name].filter(Boolean).join(' ').trim()
      const who = name || a.patient_name || 'il paziente'

      const text = `Ciao ${who}, ti ricordiamo il tuo appuntamento di domani alle ${timeRome} presso V Dental. Se non puoi venire rispondi a questo messaggio. Grazie!`

      toInsert.push({
        kind: 'day-before-19',
        status: 'queued',
        appointment_id: a.id,
        contact_id: a.contact_id ?? null,
        phone_e164: phone,
        text,
        due_at: DateTime.now().toUTC().toISO(), // accodati subito alle 19
      })
    }

    if (toInsert.length) {
      const { error: insErr } = await supa.from('reminders').insert(toInsert)
      if (insErr) return serverError(insErr.message)
    }

    return ok({
      run_at: nowRome.toISO(),
      day_processed: tomorrowISO,
      appointments_found: appts?.length ?? 0,
      reminders_created: toInsert.length,
      skipped_already_existing: (appts?.length ?? 0) - toInsert.length,
    })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
