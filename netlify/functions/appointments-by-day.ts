// netlify/functions/appointments-by-day.ts
import {
  ok,
  badRequest,
  serverError,
  supa,
  romeDayRangeUTC,
} from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD

    if (!date) return badRequest("Missing `date` param");

    const { startUTC, endUTC } = romeDayRangeUTC(date);

    const { data, error } = await supa
      .from("appointments")
      .select(
        "id, patient_name, phone_e164, appointment_at, duration_min, chair, status"
      )
      .gte("appointment_at", startUTC)
      .lt("appointment_at", endUTC)
      .order("appointment_at", { ascending: true });

    if (error) return serverError(error);

    // il frontend si aspetta { appointments: [...] }
    return ok({ appointments: data ?? [] });
  } catch (err) {
    return serverError(err);
  }
};
