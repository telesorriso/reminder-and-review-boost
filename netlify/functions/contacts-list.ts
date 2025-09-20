// netlify/functions/contacts-list.ts
import { SUPABASE_URL, supaHeaders, ok, serverError } from "./_shared";

export const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Number(url.searchParams.get("limit") || "2000"); // tutto (≈1200)
    const offset = Number(url.searchParams.get("offset") || "0");

    const params = new URLSearchParams();
    params.set("select", "id,first_name,last_name,phone_e164");
    params.set("order", "last_name.asc,first_name.asc");
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    if (q) {
      // ricerca su nome/cognome/telefono
      params.set(
        "or",
        `first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone_e164.ilike.*${q}*`
      );
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?${params}`, {
      method: "GET",
      headers: supaHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      return serverError({ step: "contacts-list", error });
    }

    const items = await res.json();
    return ok({ items });
  } catch (err: any) {
    return serverError(String(err));
  }
};
