// netlify/functions/appointments-create.ts
import {
  ok,
  badRequest,
  serverError,
  supa,
  romeToUtcISO,
  isUUID,
  splitName,
} from "./_shared";

type Body = {
  date_local: string;
  time_local: string;
  chair: 1 | 2 | number;
  duration_min: number;
  review_delay_hours?: number;

  contact_id?: string;

  patient_name?: string;
  phone_e164?: string;

  save_as_contact?: boolean;
};

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return badRequest("Use POST");

    const body = (await req.json()) as Body;

    if (!body?.date_local || !body?.time_local)
      return badRequest("Missing date_local/time_local");
    if (!body?.chair) return badRequest("Missing chair");
    if (!body?.duration_min) return badRequest("Missing duration_min");

    const appointment_at = romeToUtcISO(body.date_local, body.time_local);

    let patient_name = body.patient_name?.trim();
    let phone_e164 = body.phone_e164?.trim();

    if (body.contact_id) {
      if (!isUUID(body.contact_id)) return badRequest("Invalid contact_id");
      const { data: contact, error: cErr } = await supa
        .from("contacts")
        .select("first_name,last_name,phone_e164")
        .eq("id", body.contact_id)
        .maybeSingle();
      if (cErr) return serverError(cErr.message);
      if (!contact) return badRequest("Contact not found");
      patient_name = `${'{'}contact.last_name || ""{'}'} ${'{'}contact.first_name || ""{'}'}`.trim();
      phone_e164 = contact.phone_e164;
    }

    if (!patient_name || !phone_e164)
      return badRequest("Missing patient_name or phone_e164");

    if (body.save_as_contact && !body.contact_id) {
      const { first, last } = splitName(patient_name);
      const { error: insErr } = await supa.from("contacts").insert({
        first_name: first || null,
        last_name: last || null,
        phone_e164,
      });
      if (insErr) return serverError(`Create contact: ${'{'}insErr.message{'}'}`);
    }

    const { data: appt, error: aErr } = await supa
      .from("appointments")
      .insert({
        patient_name,
        phone_e164,
        appointment_at,
        duration_min: Math.max(15, body.duration_min),
        chair: Number(body.chair),
        status: "booked",
      })
      .select("id")
      .single();

    if (aErr) return serverError(`Create appointment: ${'{'}aErr.message{'}'}`);

    return ok({ id: appt.id, success: true });
  } catch (e: any) {
    return serverError(e?.message || "Unhandled error");
  }
};
