
import type { Handler } from '@netlify/functions'
import { requireEnv } from './_shared'

async function sendWhatsappText(phone: string, text: string, apiKey: string) {
  const res = await fetch('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': apiKey
    },
    body: JSON.stringify({ to: phone, type: 'text', text: { body: text } })
  })
  if (!res.ok) throw new Error(await res.text())
}

export const handler: Handler = async (_event) => {
  try {
    const SUPABASE_URL = requireEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const WHATSAPP_API_KEY = requireEnv('WHATSAPP_API_KEY')
    const GOOGLE_REVIEW_LINK = requireEnv('GOOGLE_REVIEW_LINK')

    const nowISO = new Date().toISOString()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?status=eq.pending&scheduled_at=lte.${encodeURIComponent(nowISO)}&select=id,appointment_id,type`, {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    })
    if (!res.ok) return { statusCode: 500, body: await res.text() }
    const msgs = await res.json()

    for (const m of msgs) {
      const lock = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ status: 'sending' })
      })
      if (!lock.ok) continue
      const updated = (await lock.json())[0]

      const apptRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${updated.appointment_id}&select=patient_name,phone_e164,appointment_at`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      })
      if (!apptRes.ok) continue
      const [appt] = await apptRes.json()

      const localTime = new Date(appt.appointment_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
      let text = ''
      if (updated.type === 'reminder_day_before') {
        text = `Ciao ${appt.patient_name}, ti ricordiamo che domani alle ${localTime} hai un appuntamento da V Dental. Se vuoi riprogrammare, rispondi pure a questo messaggio.`
      } else if (updated.type === 'reminder_same_day') {
        text = `Ciao ${appt.patient_name}, ci vediamo oggi alle ${localTime} per il tuo appuntamento da V Dental. A presto!`
      } else if (updated.type === 'review') {
        text = `Ciao ${appt.patient_name}, speriamo che la tua visita sia andata bene! Se sei soddisfatto, ci lasci una recensione su Google? Grazie 🙏\n${GOOGLE_REVIEW_LINK}`
      }

      try {
        await sendWhatsappText(appt.phone_e164, text, WHATSAPP_API_KEY)
        await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${updated.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() })
        })
      } catch (e: any) {
        await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${updated.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ status: 'failed', last_error: String(e) })
        })
      }
    }

    return { statusCode: 200, body: JSON.stringify({ processed: msgs.length }) }
  } catch (e: any) {
    return { statusCode: 500, body: e.message || 'Internal error' }
  }
}
