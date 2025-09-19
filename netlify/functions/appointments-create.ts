
import type { Handler } from '@netlify/functions'
import { checkAuth, computeSchedules, localToUTC, requireEnv, TZ } from './_shared'

export const handler: Handler = async (event) => {
  try {
    if (!checkAuth(event.headers)) return { statusCode: 401, body: 'Unauthorized' }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

    const body = JSON.parse(event.body || '{}')
    const { contact_id, patient_name, phone_e164, date_local, time_local, duration_min, chair, review_delay_hours } = body
    if ((!patient_name || !phone_e164) && !contact_id) return { statusCode: 400, body: 'Provide contact_id or patient_name+phone_e164' }
    if (!date_local || !time_local) return { statusCode: 400, body: 'Missing date_local/time_local' }

    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const reviewDelay = Number(review_delay_hours || 2)
    const duration = Math.max(15, Number(duration_min || 30))
    const chairNum = [1,2].includes(Number(chair)) ? Number(chair) : 1

    let finalName = patient_name
    let finalPhone = phone_e164
    if (contact_id && (!patient_name || !phone_e164)) {
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contact_id}&select=first_name,last_name,phone_e164`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      })
      if (!cRes.ok) return { statusCode: 500, body: await cRes.text() }
      const [c] = await cRes.json()
      if (!c) return { statusCode: 400, body: 'Invalid contact_id' }
      finalName = `${c.first_name} ${c.last_name}`
      finalPhone = c.phone_e164
    }

    const apptAtUTC = localToUTC(date_local, time_local)
    const schedules = computeSchedules(apptAtUTC, reviewDelay)

    const insertApptRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        contact_id: contact_id || null,
        patient_name: finalName,
        phone_e164: finalPhone,
        appointment_at: apptAtUTC.toISO(),
        duration_min: duration,
        chair: chairNum,
        timezone: TZ,
        review_delay_hours: reviewDelay,
        status: 'scheduled'
      })
    })
    if (!insertApptRes.ok) return { statusCode: 500, body: await insertApptRes.text() }
    const appt = (await insertApptRes.json())[0]

    const messages = [
      { appointment_id: appt.id, type: 'reminder_day_before', scheduled_at: schedules.dayBefore18UTC, payload: { name: finalName } },
      { appointment_id: appt.id, type: 'reminder_same_day', scheduled_at: schedules.sameDayMinus3hUTC, payload: { name: finalName } },
      { appointment_id: appt.id, type: 'review', scheduled_at: schedules.reviewUTC, payload: { name: finalName } },
    ]

    const insertMsgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(messages)
    })
    if (!insertMsgRes.ok) return { statusCode: 500, body: await insertMsgRes.text() }

    return { statusCode: 200, body: JSON.stringify({ ok: true, appointment_id: appt.id, schedules }) }
  } catch (e: any) {
    return { statusCode: 500, body: e.message || 'Internal error' }
  }
}
