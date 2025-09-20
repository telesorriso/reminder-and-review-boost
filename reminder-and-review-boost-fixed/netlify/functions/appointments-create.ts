// netlify/functions/appointments-create.ts
import { ok, badRequest, serverError, supa, romeToUtcISO, ensureE164, isUUID } from "./_shared";

type Body = {
  date_local: string;
  time_local: string;
  chair: number;
  duration_min: number;
  review_delay_hours?: number;
  contact_id?: string;
  patient_name?: string;
  phone_e164?: string;
  save_new_contact?: boolean;
};

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return badRequest("Use POST");
    const body = await req.json().catch(() => null) as Body | null;
    if (!body) return badRequest("Invalid JSON");

    const { date_local, time_local, chair, duration_min } = body;
    if (!date_local || !time_local) return badRequest("Missing date_local/time_local");
    if (!chair) return badRequest("Missing chair");
    if (!duration_min) return badRequest("Missing duration_min");

    let patient_name = body.patient_name?.trim();
    let phone_e164 = body.phone_e164 ? ensureE164(body.phone_e164) : null;

    if (body.contact_id) {
      if (!isUUID(body.contact_id)) return badRequest("Invalid contact_id");
      const { data: contacts, error } = await supa.from("contacts").select("id, first_name, last_name, phone_e164").eq("id", body.contact_id).limit(1);
      if (error) return serverError(error);
      if (!contacts || !contacts.length) return badRequest("Contact not found");
      const c = contacts[0];
      patient_name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
      phone_e164 = c.phone_e164;
    } else {
      if (!patient_name) return badRequest("Missing patient_name");
      if (!phone_e164) return badRequest("Missing/invalid phone_e164 in E.164 format (+39...)");
      if (body.save_new_contact) {
        const [first_name, ...rest] = patient_name.split(" ");
        const last_name = rest.join(" ");
        await supa.from("contacts").insert({ first_name, last_name, phone_e164 }).select().single().catch(() => null);
      }
    }

    const appointment_at = romeToUtcISO(date_local, time_local);

    const { data, error } = await supa.from("appointments").insert({
      patient_name,
      phone_e164,
      appointment_at,
      duration_min: Math.max(15, duration_min),
      chair,
      status: "scheduled"
    }).select().single();

    if (error) return serverError(error);

    return ok({ appointment: data });
  } catch (e) {
    return serverError(e);
  }
}
