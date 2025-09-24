import type { Handler } from '@netlify/functions'
import { supa, ok, serverError } from './_shared'

export const handler: Handler = async () => {
  try {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)

    const start = new Date(tomorrow.setHours(0,0,0,0)).toISOString()
    const end = new Date(tomorrow.setHours(23,59,59,999)).toISOString()

    const { data: appts, error } = await supa
      .from('appointments')
      .select('*')
      .gte('appointment_at', start)
      .lte('appointment_at', end)

    if (error) return serverError(error.message)

    const rows = (appts || []).map(a => ({
      appointment_id: a.id,
      phone_e164: a.phone_e164,
      body: `📅 Promemoria: hai un appuntamento domani alle ${new Date(a.appointment_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`,
      due_at: new Date().toISOString(), // subito alle 19
      status: 'pending',
    }))

    if (rows.length > 0) {
      await supa.from('scheduled_messages').insert(rows)
    }

    return ok({ queued: rows.length })
  } catch (e:any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
