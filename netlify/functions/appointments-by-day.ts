import { Handler } from "@netlify/functions";
import { supabase, ok, badRequest, serverError, romeDayRangeUTC } from "./_shared";

export const handler: Handler = async (event) => {
  try {
    const date = event.queryStringParameters?.date;
    if (!date) {
      return badRequest("Missing ?date=YYYY-MM-DD");
    }

    const { start, end } = romeDayRangeUTC(date);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id, dentist_id, chair, start_at, appointment_at, duration_min, patient_name, contact_id, note,
        contact:contact_id ( id, first_name, last_name, phone_e164 )
      `)
      .gte("coalesce(start_at, appointment_at)", start)
      .lt("coalesce(start_at, appointment_at)", end)
      .order("coalesce(start_at, appointment_at)", { ascending: true });

    if (error) {
      console.error(error);
      return serverError(error.message);
    }

    // Mappa risultato, scegliendo sempre start_at se c’è, altrimenti appointment_at
    const mapped = (data ?? []).map((a) => ({
      ...a,
      effective_start: a.start_at ?? a.appointment_at
    }));

    return ok(mapped);
  } catch (err: any) {
    console.error(err);
    return serverError(err.message);
  }
};
