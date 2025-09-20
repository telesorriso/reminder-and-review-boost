// netlify/functions/appointments-by-day.ts
import { badRequest, json, serverError, SUPABASE_URL, supaHeaders } from './_shared'
import { DateTime } from 'luxon'

export default async (req: Request) => {
  try {
    const url = new URL(req.url)
    const date_local = url.searchParams.get('date')
    if (!date_local) return badRequest('Missing date parameter')

    // inizio e fine giornata in UTC
    const startUTC = DateTime.fromISO(`${date_local}T00:00`, { zone: 'Europe/Rome' }).toUTC().toISO()
    const endUTC = DateTime.fromISO(`${date_local}T23:59`, { zone: 'Europe/Rome' }).toUTC().toISO()

    // query appointments + join con contacts
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?select=*,contacts(id,first_name,last_name,phone_e164)&appointment_at=gte.${startUTC}&appointment_at=lte.${endUTC}`,
      { headers: supaHeaders() }
    )

    if (!res.ok) {
      const t = await res.text()
      return serverError(new Error(`Failed fetching appointments: ${t}`))
    }

    const rows = await res.json()

    const appointments = rows.map((a: any) => {
      // normalizza i campi
      const startLocal = DateTime.fromISO(a.appointment_at).setZone('Europe/Rome')
      const name =
        a.contacts?.first_name || a.contacts?.last_name
          ? `${a.contacts.last_name ?? ''} ${a.contacts.first_name ?? ''}`.trim()
          : a.patient_name || ''
      const phone = a.contacts?.phone_e164 || a.phone_e164 || ''

      return {
        id: a.id,
        chair: a.chair,
        status: a.status,
        appointment_at: a.appointment_at, // UTC originale
        time_local: startLocal.toFormat('HH:mm'),
        date_local: startLocal.toISODate(),
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
