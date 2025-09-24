// netlify/functions/reminders-daily.ts
import type { Handler } from '@netlify/functions'
import { DateTime } from 'luxon'
import { supa, ok, serverError, romeDayRangeUTC } from './_shared'

/**
 * Esegue ogni giorno alle 19:00 (Europe/Rome).
 * - Legge gli appuntamenti di DOMANI
 * - Per ciascuno crea (se non esiste già) un record in `messages` con:
 *   appointment_id, type='day-before-19', scheduled_at=NOW (UTC), status='pending', payload={to,text,...}
 * L'invio reale è effettuato dal BOT su VPS che legge `messages` (status='pending' AND scheduled_at <= now()).
 */
export const handler: Handler = async () => {
  try {
    const TZ = 'Europe/Rome'
    const nowRome = DateTime.now().setZone(TZ)
    const tomorrowISO = nowRome.plus({ days: 1 }).toISODate()!  // YYYY-MM-DD
    const { start, end } = romeDayRangeUTC(tomorrowISO)

    // 1) Prendi appuntamenti di DOMANI
    const { data: appts, error: apptErr } = await supa
      .from('appointments')
      .select('id, appointment_at, patient_name, phone_e164, contact_id')
      .gte('appointment_at', start)
      .lte('appointment_at', end)

    if (apptErr) return serverError(apptErr.message)

    if (!appts || appts.length === 0) {
      return ok({ run_at: nowRome.toISO(), day_processed: tomorrowISO, appointments_found: 0, reminders_created: 0, skipped_already_existing: 0 })
    }

    const clinic = process.env.VITE_CLINIC_NAME || 'V Dental'
    const review = process.env.VITE_GOOGLE_REVIEW_LINK || ''

    // 2) Verifica quali message già esistono per evitare duplicati
    const apptIds = appts.map(a => a.id)
    const { data: existing, error: exErr } = await supa
      .from('messages')
      .select('appointment_id')
      .in('appointment_id', apptIds)
      .eq('type', 'day-before-19')

    if (exErr) return serverError(exErr.message)

    const existingSet = new Set((existing || []).map(x => x.appointment_id))

    // 3) Prepara insert per quelli mancanti
    const toInsert = appts
      .filter(a => !!a.phone_e164 && !existingSet.has(a.id))
      .map(a => {
        const when = DateTime.fromISO(a.appointment_at).setZone(TZ).toFormat('dd/LL HH:mm')
        const name = (a.patient_name || '').split(' ')[0] || ''
        const text = `Ciao ${name}! Ti ricordiamo l'appuntamento da ${clinic} il ${when}. Se dopo la visita ti trovi bene, ci aiuti con una recensione? ${review}`.trim()
        return {
          appointment_id: a.id,
          type: 'day-before-19',
          scheduled_at: new Date().toISOString(), // ora: la funzione gira alle 19:00
          status: 'pending',
          payload: {
            to: a.phone_e164,
            text,
            contact_id: a.contact_id,
            patient_name: a.patient_name,
            appointment_at: a.appointment_at,
            clinic,
            review
          }
        }
      })

    if (toInsert.length > 0) {
      const { error: insErr } = await supa.from('messages').insert(toInsert)
      if (insErr) return serverError(insErr.message)
    }

    return ok({
      run_at: nowRome.toISO(),
      day_processed: tomorrowISO,
      appointments_found: appts.length,
      reminders_created: toInsert.length,
      skipped_already_existing: appts.length - toInsert.length,
    })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
