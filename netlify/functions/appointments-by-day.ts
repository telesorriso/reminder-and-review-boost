// netlify/functions/appointments-by-day.ts
import { DateTime } from "luxon";
import { SUPABASE_URL, supaHeaders, ok, badRequest, serverError } from "./_shared";

export const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD locale
    if (!date) return badRequest("Missing ?date=YYYY-MM-DD");

    // Calcola finestra in UTC corrispondente alla giornata Europe/Rome
    const startUtc = DateTime.fromISO(`${date}T00:00`, {
      zone: "Europe/Rome",
    })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;
    const endUtc = DateTime.fromISO(`${date}T23:59:59.999`, {
      zone: "Europe/Rome",
    })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;

    const params = new URLSearchParams();
    params.set(
      "select",
      "id,patient_name,phone_e164,appointment_at,duration_min,chair,status,contact_id"
    );
    params.set("order", "appointment_at.asc");
    params.set("appointment_at", `gte.${startUtc}`);
    params.append("appointment_at", `lte.${endUtc}`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?${params}`, {
      headers: supaHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      return serverError({ step: "appointments-by-day", error });
    }

    const appointments = await res.json();
    return ok({ appointments });
  } catch (err: any) {
    return serverError(String(err));
  }
};
