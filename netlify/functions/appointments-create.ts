// netlify/functions/appointments-create.ts
import {
  SUPABASE_URL,
  supaHeaders,
  ok,
  badRequest,
  serverError,
  romeToUtcISO,
  splitName,
  isUUID,
} from "./_shared";

type Body = {
  /** data/ora locali (Europe/Rome) */
  date_local: string; // YYYY-MM-DD
  time_local: string; // HH:mm
  chair: number;
  duration_min: number;
  review_delay_hours?: number;

  /** se uso un contatto esistente */
  contact_id?: string;

  /** se inserisco manualmente */
  patient_name?: string;
  phone_e164?: string;

  /** opzionale: salva come nuovo contatto */
  save_contact?: boolean;
};

export const handler = async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return badRequest("Use POST");

    const body = (await req.json()) as Body;

    // Validazione minima
    if (!body?.date_local || !body?.time_local) {
      return badRequest("Missing date_local or time_local");
    }
    if (!body?.chair || !body?.duration_min) {
      return badRequest("Missing chair or duration_min");
    }

    const appointment_at = romeToUtcISO(body.date_local, body.time_local);

    // Se è presente un contact_id, prendo i suoi dati per nome/telefono
    let contact_id: string | null = null;
    let patient_name = body.patient_name?.trim() || "";
    let phone_e164 = body.phone_e164?.trim() || "";

    if (body.contact_id) {
      if (!isUUID(body.contact_id)) return badRequest("Invalid contact_id");
      contact_id = body.contact_id;

      const cRes = await fetch(
        `${SUPABASE_URL}/rest/v1/contacts?id=eq.${contact_id}&select=first_name,last_name,phone_e164`,
        { headers: supaHeaders() }
      );
      if (!cRes.ok) {
        return serverError({
          step: "fetch-contact",
          error: await cRes.text(),
        });
      }
      const [c] = await cRes.json();
      if (!c) return badRequest("contact_id not found");

      patient_name = `${c.first_name} ${c.last_name}`.trim();
      phone_e164 = c.phone_e164;
    }

    // Se si chiede di salvare come contatto
    if (body.save_contact && !contact_id) {
      if (!patient_name || !phone_e164) {
        return badRequest("Missing patient_name or phone_e164 to save contact");
      }
      const { first_name, last_name } = splitName(patient_name);
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: "POST",
        headers: supaHeaders(),
        body: JSON.stringify([{ first_name, last_name, phone_e164 }]),
      });
      if (!ins.ok) {
        return serverError({
          step: "insert-contact",
          error: await ins.text(),
        });
      }
      const [row] = await ins.json();
      contact_id = row?.id || null;
    }

    // Inserisco l'appuntamento
    const payload = [
      {
        contact_id,
        patient_name,
        phone_e164,
        appointment_at, // UTC
        duration_min: Math.max(15, Number(body.duration_min || 30)),
        chair: Number(body.chair),
        status: "scheduled",
        review_delay_hours: Number(body.review_delay_hours || 2),
      },
    ];

    const aRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: supaHeaders(),
      body: JSON.stringify(payload),
    });

    if (!aRes.ok) {
      return serverError({
        step: "insert-appointment",
        error: await aRes.text(),
      });
    }

    const [app] = await aRes.json();
    return ok({ appointment: app });
  } catch (err: any) {
    return serverError(String(err));
  }
};
