// netlify/functions/appointments-by-day.ts
import { ok, badRequest, serverError, supa } from "./_shared";
import { DateTime } from "luxon";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    if (!date) return badRequest("Missing date");

    const start = DateTime.fromISO(date, { zone: "Europe/Rome" }).startOf("day").toUTC().toISO();
    const end = DateTime.fromISO(date, { zone: "Europe/Rome" }).endOf("day").toUTC().toISO();

    const { data, error } = await supa
      .from("appointments")
      .select("id, patient_name, phone_e164, appointment_at, duration_min, chair, status")
      .gte("appointment_at", start)
      .lte("appointment_at", end)
      .order("appointment_at", { ascending: true });

    if (error) return serverError(error);
    return ok({ appointments: data || [] });
  } catch (e) {
    return serverError(e);
  }
}
