// netlify/functions/appointments-by-day.ts
import { ok, badRequest, serverError, supa, romeDayRangeUTC } from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");

    if (!date) return badRequest("Missing 'date' (YYYY-MM-DD)");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return badRequest("Invalid 'date' format (YYYY-MM-DD)");

    const { start, end } = romeDayRangeUTC(date);

    const { data, error } = await supa
      .from("appointments")
      .select(
        "id, patient_name, phone_e164, appointment_at, duration_min, chair, status"
      )
      .gte("appointment_at", start)
      .lt("appointment_at", end)
      .order("appointment_at", { ascending: true });

    if (error) return serverError(error.message);

    return ok({ appointments: data ?? [] });
  } catch (e: any) {
    return serverError(e?.message || "Unhandled error");
  }
};
