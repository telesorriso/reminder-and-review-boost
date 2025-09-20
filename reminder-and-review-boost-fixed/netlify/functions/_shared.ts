// netlify/functions/_shared.ts
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export function json(body: any, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : (init as ResponseInit).status || 200;
  const headers = new Headers(typeof init === "number" ? {} : (init as ResponseInit).headers);
  if (!headers.get("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...(typeof init === "number" ? { status } : init), headers });
}

export const ok = (body: any) => json(body, 200);
export const badRequest = (msg: any) => json({ error: String(msg) }, 400);
export const serverError = (err: any) => json({ error: "Unhandled error", details: String(err?.message || err) }, 500);

export function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function romeToUtcISO(date_local: string, time_local: string) {
  const dt = DateTime.fromISO(`${date_local}T${time_local}`, { zone: "Europe/Rome" });
  return dt.toUTC().toISO();
}

export function ensureE164(phone: string) {
  if (!phone) return null;
  const s = phone.replace(/\s+/g, "");
  return /^\+\d{6,15}$/.test(s) ? s : null;
}
