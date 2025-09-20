// netlify/functions/appointments-create.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, supaHeaders, SUPABASE_URL } from './_shared'

// ---- Helpers (tutte ritornano {statusCode, headers, body}) ----
async function parseJsonBody(eventBody: string | null | undefined) {
  const raw = eventBody ?? ''
  if (!raw.trim()) throw new Error('EMPTY_BODY')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function serverError(message: string, extra: any = {}) {
  return {
    statusCode: 500,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: message, ...extra }),
  }
}

// ---- Handler ----
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return badRequest('Use POST')

    // parse robusta del body
    let body: any
    try {
      body = await parseJsonBody(event.body)
    } catch (e: any) {
      if (e?.message === 'EMPTY_BODY') return badRequest('Empty request body')
      if (e?.message === 'INVALID_JSON') return badRequest('Invalid JSON body')
      return serverError('Body parse error')
    }

    // campi attesi
    const {
      contact_id,
      patient_name,
      phone_e164,
      appointment_at,
      chair,
      duration_min,
      review_delay_hours,
      save_contact,
    } = body || {}

    // validazioni
    if (!appointment_at) return badRequest('Missing appointment_at')
    if (!chair) return badRequest('Missing chair')
    if (!duration_min) return badRequest('Missing duration_min')
    if (review_delay_hours === undefined || review_delay_hours === null)
      return badRequest('Missing review_delay_hours')

    if (!contact_id) {
      if (!patient_name || !phone_e164) {
        return badRequest('Missing patient_name or phone_e164')
      }
    }

    // 1) opzionale: salva/aggiorna contatto (upsert su phone_e164)
    let effectiveContactId: string | undefined = contact_id
    if (!effectiveContactId && save_contact && phone_e164) {
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: 'POST',
        headers: { ...supaHeaders(), prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([
          {
            first_name: String(patient_name || '').split(' ')[0] || null,
            last_name: String(patient_name || '').split(' ').slice(1).join(' ') || null,
            phone_e164,
          },
        ]),
      })
      if (!upsertRes.ok) {
        const t = await upsertRes.text()
        return serverError('Failed upserting contact', { details: t })
      }

      // recupero id contatto
      const q = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
      q.searchParams.set('select', 'id')
      q.searchParams.set('phone_e164', `eq.${phone_e164}`)
      const getRes = await fetch(q, { headers: supaHeaders() })
      const rows = (await getRes.json()) as any[]
      effectiveContactId = rows?.[0]?.id
    }

    // 2) crea appuntamento
    const apptPayload: any = {
      appointment_at, // ISO UTC
      duration_min,
      chair,
      status: 'scheduled',
    }
    if (effectiveContactId) {
      apptPayload.contact_id = effectiveContactId
    } else {
      apptPayload.patient_name = patient_name
      apptPayload.phone_e164 = phone_e164
    }

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify([apptPayload]),
    })
    if (!ins.ok) {
      const t = await ins.text()
      return serverError('Failed creating appointment', { details: t })
    }
    const created = await ins.json()

    // 3) programma i messaggi (esempio semplice su tabella messages)
    const twoHoursBefore = new Date(new Date(appointment_at).getTime() - 2 * 60 * 60 * 1000).toISOString()
    const reviewAt = new Date(new Date(appointment_at).getTime() + Number(review_delay_hours) * 3600 * 1000).toISOString()

    const sched = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify([
        {
          kind: 'reminder',
          status: 'pending',
          send_at: twoHoursBefore,
          appointment_at,
          phone_e164: phone_e164 ?? null,
          contact_id: effectiveContactId ?? null,
        },
        {
          kind: 'review',
          status: 'pending',
          send_at: reviewAt,
          appointment_at,
          phone_e164: phone_e164 ?? null,
          contact_id: effectiveContactId ?? null,
        },
      ]),
    })
    if (!sched.ok) {
      const t = await sched.text()
      return serverError('Failed scheduling messages', { details: t })
    }

    // risposta OK
    return json({ ok: true, appointment: created?.[0] ?? null })
  } catch (err: any) {
    return serverError('Unhandled error', { details: err?.message })
  }
}
