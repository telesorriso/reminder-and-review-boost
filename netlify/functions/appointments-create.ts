// netlify/functions/appointments-create.ts
import type { Handler } from "@netlify/functions"
import { ok, badRequest, serverError, supa, romeToUtcISO } from "./_shared"
import { DateTime } from "luxon"

type Body = {
  chair?: number
  date?: string            // "YYYY-MM-DD" (Europe/Rome)
  day?: string             // alternative "YYYY-MM-DD"
  date_local?: string      // alternative
  dateLocal?: string       // alternative
  time?: string            // "HH:mm" (Europe/Rome)
  time_local?: string      // alternative
  timeLocal?: string       // alternative
  start_at?: string        // ISO (UTC o locale) opzionale
  startAt?: string
  duration_min?: number
  contact_id?: string
  patient_name?: string
  dentist_id?: string
  note?: string
}

const pick = (...vals: (string | undefined | null)[]) =>
  (vals.find(v => typeof v === "string" && v.trim().length > 0) || "").trim()

export const handler: Handler = async (event) => {
  // Parse body
  let body: Body | null = null
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : null
  } catch {
    return badRequest("Invalid JSON body")
  }
  if (!body) return badRequest("Missing JSON body")

  try {
    const dentist_id = (body.dentist_id || "main").trim()
    const note = (body.note || "").trim()
    const chair = Number(body.chair || 0)
    const duration_min = Number(body.duration_min || 30)
    const contact_id = body.contact_id || null
    const patient_name = (body.patient_name || "").trim() || null

    if (!chair || chair < 1) return badRequest("Missing or invalid 'chair'")
    if (!duration_min || duration_min <= 0) return badRequest("Missing or invalid 'duration_min'")

    // 1) Normalizza data/ora
    let dateStr = pick(body.date, body.day, body.date_local, body.dateLocal)
    let timeStr = pick(body.time, body.time_local, body.timeLocal)

    // 2) Se arriva uno start_at / startAt, prova a ricavarne data/ora Europe/Rome
    const isoStart = pick(body.start_at, body.startAt)
    if ((!dateStr || !timeStr) && isoStart) {
      const dt = DateTime.fromISO(isoStart, { setZone: true })
      if (dt.isValid) {
        const rome = dt.setZone("Europe/Rome")
        if (!dateStr) dateStr = rome.toFormat("yyyy-LL-dd")
        if (!timeStr) timeStr = rome.toFormat("HH:mm")
      }
    }

    // 3) Se ancora manca date, prova dai query param (?date=YYYY-MM-DD)
    if (!dateStr) {
      const url = new URL(event.rawUrl)
      const qpDate = (url.searchParams.get("date") || "").trim()
      if (qpDate) dateStr = qpDate
    }

    // Validazioni finali
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return badRequest("Missing or invalid 'date' (YYYY-MM-DD)")
    }
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      return badRequest("Missing or invalid 'time' (HH:mm)")
    }

    // 4) Calcolo start_at UTC dal giorno/ora di Roma
    const start_at = romeToUtcISO(dateStr, timeStr)
    if (!start_at) return serverError("Failed to compute start_at")

    // 5) Insert
    const { data, error } = await supa
      .from("appointments")
      .insert([{
        dentist_id,
        chair,
        start_at,           // timestamptz (UTC)
        duration_min,
        contact_id,
        patient_name,
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
