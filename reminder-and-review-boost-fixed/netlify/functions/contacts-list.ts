// netlify/functions/contacts-list.ts
import { ok, badRequest, serverError, supa } from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limitStr = url.searchParams.get("limit");
    const limit = limitStr ? Math.min(2000, Math.max(1, parseInt(limitStr))) : 2000;

    let query = supa.from("contacts").select("id, first_name, last_name, phone_e164").order("last_name", { ascending: true });

    if (q) {
      const like = `%${q}%`;
      query = query.or(`first_name.ilike.${like},last_name.ilike.${like},phone_e164.ilike.${like}`);
    }

    const { data, error } = await query.limit(limit);
    if (error) return serverError(error);
    return ok({ items: data || [] });
  } catch (e) {
    return serverError(e);
  }
}
