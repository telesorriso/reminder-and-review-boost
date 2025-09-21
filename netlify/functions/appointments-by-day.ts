import type { Handler } from "@netlify/functions";
import { ok, badRequest, serverError, supa, romeDayRangeUTC } from "./_shared";

/**
 * NOTA: PostgREST non accetta funzioni in filter (quindi niente "coalesce(col1,col2)" in .gte/.lt).
 * Usiamo un OR: (start_at nel range) OR (appointment_at nel range).
 */
export const handler: Handler = async (event) => {
  const date =
    new URL(event.rawUrl).searchParams.get("date") ||
    event.queryStringParameters?.date ||
    "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return badRequest("Missing ?date=YYYY-MM-DD");
  }

  try {
    const { start, end } = romeDayRangeUTC(date);

    const { data, error } = await supa
      .from("appointments")
      .select(`
        id, dentist_id, chair, start_at, appointment_at, duration_min, patient_name, contact_id, note, phone_e164,
        contact:contact_id ( id, first_name, last_name, phone_e164 )
      `)
      .or(
        `and(start_at.gte.${start},start_at.lt.${end}),and(appointment_at.gte.${start},appointment_at.lt.${end})`
      )
      // ordina prima per start_at (se presente), poi per appointment_at (fallback)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("appointment_at", { ascending: true, nullsFirst: false });

    if (error) return serverError(error);

    const mapped = (data ?? []).map((a: any) => {
      const fullName = [a.contact?.first_name, a.contact?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const displayName =
        a.patient_name || fullName || a.contact?.phone_e164 || a.phone_e164 || "Sconosciuto";
      const effective_start = a.start_at ?? a.appointment_at;
      return { ...a, patient_name: displayName, effective_start };
    });

    return ok({ items: mapped });
  } catch (e) {
    return serverError(e);
  }
};
