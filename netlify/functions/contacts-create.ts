// netlify/functions/contacts-create.ts
import { ok, badRequest, serverError, supa } from "./_shared";

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return badRequest("Use POST");

    const body = await req.json().catch(() => null) as
      | { first_name?: string; last_name?: string; phone_e164?: string }
      | null;
    if (!body) return badRequest("Invalid JSON body");

    const first_name = (body.first_name || "").trim();
    const last_name  = (body.last_name  || "").trim();
    const phone_e164 = (body.phone_e164 || "").trim();

    if (!first_name || !phone_e164) return badRequest("Missing first_name or phone_e164");
    if (!/^\+[\d]{6,16}$/.test(phone_e164)) return badRequest("phone_e164 must be in E.164 format (+39...)");

    const { data, error } = await supa
      .from("contacts")
      .upsert({ first_name, last_name, phone_e164 }, { onConflict: "phone_e164", ignoreDuplicates: false })
      .select("id, first_name, last_name, phone_e164")
      .single();

    if (error) return serverError(error);
    return ok({ contact: data });
  } catch (e) {
    return serverError(e);
  }
};
