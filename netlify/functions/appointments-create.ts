import type { Handler } from "@netlify/functions";
import { ok, badRequest, serverError, supa, romeToUtcISO } from "./_shared";

type Body = {
  chair?: number;
  date?: string;
  day?: string;
  date_local?: string;
  dateLocal?: string;
  time?: string;
  time_local?: string;
  timeLocal?: string;
  duration_min?: number;
  contact_id?: string;
  patient_name?: string;
  dentist_id?: string;
  note?: string;
  phone_e164?: string; // compat: colonna presente in appointments (via rapida)
};

const pick = (...vals: (string | undefined | null)[]) =>
  (vals.find(v => typeof v === "string" && v.trim().length > 0) || "").trim();

export const handler: Handler = async (event) => {
  // parse body safe
  let body: Body | null = null;
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : null;
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body) return badRequest("Missing JSON body");

  try {
    const dentist_id = (body.dentist_id || "main").trim();
    const chair = Number(body.chair || 0);
    const duration_min = Number(body.duration_min || 30);
    const note = (body.note || "").trim() || null;
    const contact_id = body.contact_id || null;
    const patient_name = (body.patient_name || "").trim() || null;
    const phone_e164 = (body.phone_e164 || "").trim() || null;

    if (!chair || chair < 1) return badRequest("Missing or invalid 'chair'");
    if (!duration_min || duration_min <= 0) return badRequest("Missing or invalid 'duration_min'");

    // normalizza date/time (Europa/Roma)
    const date = pick(body.date, body.day, body.date_local, body.dateLocal);
    const time = pick(body.time, body.time_local, body.timeLocal);
    const start_at = romeToUtcISO(date, time);
    if (!start_at) return badRequest("Missing or invalid 'date'/'time'");

    // inserisco valorizzando sia start_at che appointment_at (compat)
    const { data, error } = await supa
      .from("appointments")
      .insert([{
        dentist_id,
        chair,
        start_at,                 // nuovo
        appointment_at: start_at, // compat
        duration_min,
        contact_id,
        patient_name,
        note,
        phone_e164                // compat: colonna presente
      }])
      .select("id, dentist_id, chair, start_at, appointment_at, duration_min, patient_name, contact_id, note, phone_e164")
      .single();

    if (error) return serverError(error);
    return ok({ appointment: data });
  } catch (e) {
    return serverError(e);
  }
};
