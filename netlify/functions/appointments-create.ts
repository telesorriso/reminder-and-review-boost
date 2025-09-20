// netlify/functions/appointments-create.ts
import type { Handler } from '@netlify/functions'
import { json, badRequest, supaHeaders, SUPABASE_URL } from './_shared'

// Utility: parse robusta del body
async function parseJsonBody(req: Request) {
  const raw = await req.text()
  if (!raw || !raw.trim()) {
    throw new Error('EMPTY_BODY')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('INVALID_JSON')
  }
}

// Utility: risposta 500 JSON
function serverJsonError(message: string, extra: any = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}

// NB: questa function si aspetta appointment_at in ISO UTC dal client.
// (Il tuo frontend già lo invia; se manca, restituiamo 400 chiaro.)
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return badRequest('Use POST')
  }

  let body: any
  try {
    body = await parseJsonBody(new Request('http://x', { body: event.body ?? '', method: 'POST' }))
  } catch (e: any) {
    if (e?.message === 'EMPTY_BODY') return badRequest('Empty request body')
    if (e?.message === 'INVALID_JSON') return badRequest('Invalid JSON body')
    return serverJsonError('Body parse error')
  }

  // campi attesi
  const {
    // variante A: uso contatto esistente
    contact_id,
    // variante B: inserimento manuale
    patient_name,
    phone_e164,
    // comuni
    appointment_at,              // ISO UTC obbligatorio (calcolato dal client)
    chair,
    duration_min,
    review_delay_hours,
    // opzionale: crea/aggiorna contatto
    save_contact,
  } = body || {}

  if (!appointment_at) return badRequest('Missing appointment_at')
  if (!chair) return badRequest('Missing chair')
  if (!duration_min) return badRequest('Missing duration_min')
  if (!review_delay_hours && review_delay_hours !== 0) return badRequest('Missing review_delay_hours')

  // se uso contatto, ok; se inserisco manualmente, servono nome e telefono
  if (!contact_id) {
    if (!patient_name || !phone_e164) {
      return badRequest('Missing patient_name or phone_e164')
    }
  }

  try {
    // 1) Se richiesto: salva/aggiorna contatto (upsert su phone_e164)
    let effectiveContactId = contact_id as string | undefined
    if (!effectiveContactId && save_contact && phone_e164) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: 'POST',
        headers: {
          ...supaHeaders(), // usa service role
          'prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify([{
          // se esiste stessa phone_e164 l’upsert aggiorna first/last name
          first_name: String(patient_name || '').split(' ')[0] || null,
          last_name:  String(patient_name || '').split(' ').slice(1).join(' ') || null,
          phone_e164,
        }]),
      })
      if (!res.ok) {
        const t = await res.text()
        return serverJsonError('Failed upserting contact', { details: t })
      }
      // recupero id del contatto (select appena creato/aggiornato)
      const q = new URL(`${SUPABASE_URL}/rest/v1/contacts`)
      q.searchParams.set('select', 'id')
      q.searchParams.set('phone_e164', `eq.${phone_e164}`)
      const getRes = await fetch(q, { headers: supaHeaders() })
      const [row] = await getRes.json() as any[]
      effectiveContactId = row?.id
    }

    // 2) Crea appuntamento
    const apptPayload: any = {
      appointment_at, // ISO UTC
      duration_min,
      chair,
      status: 'scheduled',
    }

    if (effectiveContactId) {
      apptPayload.contact_id = effectiveContactId
    } else {
      // salvataggio “inline” dei dati (se non c’è contatto)
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
      return serverJsonError('Failed creating appointment', { details: t })
    }
    const created = await ins.json()

    // 3) Programma i messaggi (edge: qui semplifico: inserisco “scheduled_messages”)
    // (se hai già una function o una tabella diversa, adatta questo blocco)
    const sched = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify([
        {
          kind: 'reminder',
          status: 'pending',
          send_at: new Date(new Date(appointment_at).getTime() - 120 * 60000).toISOString(), // 2h prima default
          appointment_at,
          phone_e164: phone_e164, // se presente da manuale
          contact_id: effectiveContactId ?? null,
        },
        {
          kind: 'review',
          status: 'pending',
          send_at: new Date(new Date(appointment_at).getTime() + Number(review_delay_hours) * 3600 * 1000).toISOString(),
          appointment_at,
          phone_e164: phone_e164,
          contact_id: effectiveContactId ?? null,
        }
      ]),
    })
    if (!sched.ok) {
      const t = await sched.text()
      return serverJsonError('Failed scheduling messages', { details: t })
    }

    return json({ ok: true, appointment: created?.[0] ?? null })
  } catch (err: any) {
    return serverJsonError('Unhandled error', { details: err?.message })
  }
}

export default { handler }
