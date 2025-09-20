// netlify/functions/contacts-list.ts
import { ok, badRequest, serverError, supa } from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "2000", 10) || 2000, 5000); // nessun limite pratico per 1200 contatti

    let query = supa.from("contacts").select("id, first_name, last_name, phone_e164").order("last_name", { ascending: true }).limit(limit);

    if (q) {
      // ricerca per nome/cognome/telefono
      const like = `%${q}%`;
      query = supa
        .from("contacts")
        .select("id, first_name, last_name, phone_e164")
        .or(`first_name.ilike.${like},last_name.ilike.${like},phone_e164.ilike.${like}`)
        .order("last_name", { ascending: true })
        .limit(limit);
    }

    const { data, error } = await query;
    if (error) return serverError(error);

    return ok({ items: data || [] });
  } catch (e) {
    return serverError(e);
  }
};
