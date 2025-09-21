import { Handler } from "@netlify/functions";
import { supabase, ok, badRequest, serverError } from "./_shared";

export const handler: Handler = async (event) => {
  try {
    if (!event.body) {
      return badRequest("Missing body");
    }

    const body = JSON.parse(event.body);

    const { date, time, duration_min, dentist_id, chair, contact_id, patient_name, note, phone_e164 } = body;

    if (!date || !time) {
      return badRequest("Missing or invalid 'date' (YYYY-MM-DD) or 'time' (HH:mm)");
    }

    // Combina data + ora in UTC
    const start_at = new Date(`${date}T${time}:00.000Z`).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .insert([{
        dentist_id,
        chair,
        start_at,           // nuovo
        appointment_at: start_at, // legacy, per compatibilità
        duration_min,
        contact_id,
        patient_name,
        note,
        phone_e164
      }])
      .select("id, dentist_id, chair, start_at, appointment_at, duration_min, patient_name, contact_id, note")
      .single();

    if (error) {
      console.error(error);
      return serverError(error.message);
    }

    return ok(data);
  } catch (err: any) {
    console.error(err);
    return serverError(err.message);
  }
};
