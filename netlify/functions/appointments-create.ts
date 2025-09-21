import type { Handler } from "@netlify/functions"
import { supabase, ok, badRequest, serverError } from "./_shared"

export const handler: Handler = async (event) => {
  // Parse body in modo sicuro
  let body: any = null
  try {
    body = event.body ? JSON.parse(event.body) : null
  } catch (_) {
    return badRequest("Invalid JSON body")
  }
  if (!body) return badRequest("Missing JSON body")

  try {
    const { chair, date, time, duration_min, contact_id } = body

    if (!chair || !date || !time || !duration_min || !contact_id) {
      return badRequest("Missing required fields")
    }

    // Costruisci start_at e end_at
    const start_at = `${date}T${time}:00`
    const end_at = new Date(new Date(start_at).getTime() + duration_min * 60000).toISOString()

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          chair,
          start_at,
          end_at,
          contact_id,
        },
      ])
      .select()

    if (error) {
      return serverError(error)
    }

    return ok({ appointment: data?.[0] })
  } catch (e) {
    return serverError(e)
  }
}
