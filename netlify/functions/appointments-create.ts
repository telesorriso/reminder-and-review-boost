// netlify/functions/appointments-create.ts
import type { Handler } from "@netlify/functions"
import { ok, badRequest, serverError, supa, romeToUtcISO } from "./_shared"

type Body = {
  chair?: number
  date?: string          // "YYYY-MM-DD" (giorno Europa/Roma)
  time?: string          // "HH:mm"     (ora Europa/Roma)
  duration_min?: number  // es. 30
  contact_id?: string    // UUID opzionale (se assente puoi salvare solo patient_name)
  patient_name?: string  // opzionale; fallback al nome del contatto se presente
  dentist_id?: string    // opzionale; default "main"
  note?: string          // opzionale
}

export const handler: Handler = async (event) => {
  // ---- Parse JSON body in modo sicuro
  let body: Body | null = null
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : null
  } catch {
    return badRequest("Invalid JSON body")
  }
  if (!body) return badRequest("Missing JSON body")

  try {
    const {
      chair,
      date,
      time,
      duration_min = 30,
      contact_id,
      patient_name,
      dentist_id = "main",
      note = ""
    } = body

    // ---- Validazioni minime
    if (!chair || chair < 1) return badRequest("Missing or invalid 'chair'")
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("Missing or invalid 'date' (YYYY-MM-DD)")
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return badRequest("Missing or invalid 'time' (HH:mm)")
    if (!duration_min || duration_min <= 0) return badRequest("Missing or invalid 'duration_min'")

    // ---- Calcolo start_at in UTC partendo da Europe/Rome
    // usa util fornito da _shared.ts
    const start_at = romeToUtcISO(date, time)  // ISO string UTC
    if (!start_at) return serverError("Failed to compute start_at")

    // ---- patient_name finale
    // se non passato, lascio null: la UI userà il nome del contatto quando presente
    const finalPatientName = (patient_name || "").trim() || null

    // ---- Insert
    const { data, error } = await supa
      .from("appointments")
      .insert([{
        dentist_id,
        chair,
        start_at,           // timestamptz in UTC
        duration_min,       // int
        contact_id: contact_id || null,
        patient_name: finalPatientName,
        note
      }])
      .select("id, dentist_id, chair, start_at, duration_min, patient_name, contact_id, note")
      .single()

    if (error) return serverError(error)

    return ok({ appointment: data })
  } catch (e) {
    return serverError(e)
  }
}
