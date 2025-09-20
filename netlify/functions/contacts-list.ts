// netlify/functions/contacts-list.ts
import {
  ok,
  badRequest,
  serverError,
  supa,
} from "./_shared";

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    // query base
    let qb = supa
      .from("contacts")
      .select("id, first_name, last_name, phone_e164")
      .order("last_name", { ascending: true })
      .limit(2000); // carichiamo tutto (≈1200)

    // filtro lato DB se c'è q
    if (q) {
      // cerchiamo su first_name, last_name e phone_e164
      qb = qb.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone_e164.ilike.%${q}%`
      );
    }

    const { data, error } = await qb;
    if (error) return serverError(error);

    // il frontend si aspetta { items: [...] }
    return ok({ items: data ?? [] });
  } catch (err) {
    return serverError(err);
  }
};
