// netlify/functions/appointments-by-day.ts
import { badRequest, json, serverError, SUPABASE_URL, supaHeaders } from './_shared'
import { DateTime } from 'luxon'

const TZ = 'Europe/Rome'

export default async (req: Request) => {
  try {
    const url = new URL(req.url)
    const date_local = url.searchParams.get('date')
    if (!date_local) return badRequest('Missing date parameter')

    // Inizio/fine giornata in UTC, partendo dall’ora locale
    const startUTC = DateTime.fromISO(`${date_local}T00:00`, { zone: TZ }).toUTC().toISO()
    const endUTC   = DateTime.fromISO(`${date_local}T23:59:59`, { zone: TZ }).toUTC().toISO()

    // appointments + join contatti
    const q = new URL(
      `${SUPABASE_URL}/rest/v1/appointments?select=*,contacts(id,first_name,last_name,phone_e164)`
    )
    q.searchParams.set('appointment_at', `gte.${startUTC!}`)
    q.searchParams.append('appointment_at', `lte.${endUTC!}`)
    q.searchParams.set('order', 'appointment_at.asc')
    q.searchParams.set('limit', '2000')

    const res = await fetch(q.toString(), { headers: supaHeaders() })
    if (!res.ok) return serverError(await res.text())
    const rows = await res.json()

    const appointments = rows.map((a: any) => {
      const startLocal = DateTime.fromISO(a.appointment_at).setZone(TZ)
      const name =
        a?.contacts
          ? `${a.contacts.last_name ?? ''} ${a.contacts.first_name ?? ''}`.trim()
          : (a.patient_name ?? '')
      const phone = a?.contacts?.phone_e164 || a.phone_e164 || ''

      return {
        id: a.id,
        chair: a.chair,
        status: a.status,
        appointment_at: a.appointment_at,     // UTC
        date_local: startLocal.toISODate(),    // es. 2025-09-20
        time_local: startLocal.toFormat('HH:mm'),
        duration_min: a.duration_min,
        patient_name: name,
        phone_e164: phone,
      }
    })

    return json({ appointments })
  } catch (e) {
    return serverError(e)
  }
}
