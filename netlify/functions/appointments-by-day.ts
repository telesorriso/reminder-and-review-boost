// Ritorna tutti gli appuntamenti del giorno (ora DB in UTC) + nome/cognome del contatto
import {
  ok,
  badRequest,
  serverError,
  supa,
  romeDayRangeUTC,
} from './_shared'

export default async (req: Request) => {
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get('date') // es. 2025-09-21
    if (!date) return badRequest('Missing date')

    const { start, end } = romeDayRangeUTC(date)

    // JOIN con "contacts" tramite la FK contact_id
    const { data, error } = await supa
      .from('appointments')
      .select(`
        id,
        patient_name,
        phone_e164,
        appointment_at,
        duration_min,
        chair,
        status,
        contact:contacts!appointments_contact_id_fkey (
          first_name,
          last_name,
          phone_e164
        )
      `)
      .gte('appointment_at', start)
      .lt('appointment_at', end)
      .order('appointment_at', { ascending: true })

    if (error) return serverError(error.message)

    // Rendo il payload piatto e compatibile con il frontend
    const appointments = (data ?? []).map((a: any) => ({
      id: a.id,
      patient_name: a.patient_name, // potrebbe essere già valorizzato
      phone_e164: a.phone_e164,
      appointment_at: a.appointment_at,
      duration_min: a.duration_min,
      chair: a.chair,
      status: a.status,
      contact_first_name: a.contact?.first_name ?? null,
      contact_last_name:  a.contact?.last_name ?? null,
    }))

    return ok({ appointments })
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error')
  }
}
