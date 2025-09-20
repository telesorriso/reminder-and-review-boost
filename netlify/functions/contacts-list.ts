import type { Handler } from '@netlify/functions';
import { SUPABASE_URL, supaHeaders, ok, serverError } from './_shared';

export const handler: Handler = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=id,first_name,last_name,phone_e164&order=last_name.asc,first_name.asc`, {
      headers: supaHeaders(),
    });
    if (!res.ok) throw await res.text();
    const rows = await res.json();
    return ok({ contacts: rows });
  } catch (e) {
    return serverError(e);
  }
};
