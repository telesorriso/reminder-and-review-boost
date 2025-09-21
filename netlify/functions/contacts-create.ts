// netlify/functions/contacts-create.ts
import { ok, badRequest, serverError, supa, ensureE164 } from "./_shared";

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return badRequest("Use POST");
    const body = await req.json().catch(() => null) as { first_name?: string; last_name?: string; phone_e164?: string } | null;
    if (!body) return badRequest("Invalid JSON");

    const first_name = (body.first_name || "").trim();
    const last_name = (body.last_name || "").trim();
    const phone = ensureE164(body.phone_e164 || "");

    if (!first_name && !last_name) return badRequest("Missing name");
    if (!phone) return badRequest("Missing/invalid phone_e164 in E.164 format (+39...)");

    const { data, error } = await supa.from("contacts").insert({ first_name, last_name, phone_e164: phone }).select().single();
    if (error) return serverError(error);
    return ok({ contact: data });
  } catch (e) {
    return serverError(e);
  }
}
