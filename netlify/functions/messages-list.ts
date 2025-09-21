// netlify/functions/messages-list.ts
import { ok, serverError, supa } from "./_shared";

export default async (_req: Request) => {
  try {
    const { data, error } = await supa.from("messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return serverError(error);
    return ok({ items: data || [] });
  } catch (e) {
    return serverError(e);
  }
}
