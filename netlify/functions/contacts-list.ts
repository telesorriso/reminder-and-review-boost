// netlify/functions/contacts-list.ts
import { ok, serverError, supa } from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Number(url.searchParams.get("limit") || "2000");

    let query = supa
      .from("contacts")
      .select("id, first_name, last_name, phone_e164")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(limit);

    if (q) {
      query = query.or(
        `first_name.ilike.%${'{'}q{'}'}%,last_name.ilike.%${'{'}q{'}'}%,phone_e164.ilike.%${'{'}q{'}'}%`
      );
    }

    const { data, error } = await query;
    if (error) return serverError(error.message);

    return ok({ contacts: data ?? [] });
  } catch (e: any) {
    return serverError(e?.message || "Unhandled error");
  }
};
