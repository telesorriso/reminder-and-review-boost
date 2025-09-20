// netlify/functions/_shared.ts
import { DateTime } from "luxon";

/** Env */
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn("[_shared] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

/** Headers per chiamare la REST API di Supabase */
export function supaHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: "return=representation",
  };
}

/** Helper per le Response JSON */
export function json(data: any, init: number | ResponseInit = 200): Response {
  const base: ResponseInit =
    typeof init === "number" ? { status: init } : init ?? {};
  return new Response(JSON.stringify(data), {
    ...base,
    headers: {
      "Content-Type": "application/json",
      ...(base.headers || {}),
    },
  });
}
export const ok = (data: any, status = 200) => json(data, status);
export const badRequest = (message: any) => json({ error: message }, 400);
export const serverError = (message: any) => json({ error: message }, 500);

/** Converte data/ora locali Europe/Rome in ISO UTC per il DB */
export function romeToUtcISO(dateLocal: string, timeLocal: string): string {
  const dt = DateTime.fromISO(`${dateLocal}T${timeLocal}`, {
    zone: "Europe/Rome",
  }).toUTC();
  return dt.toISO({ suppressMilliseconds: true })!;
}

/** Split semplice "Nome Cognome" */
export function splitName(full: string): { first_name: string; last_name: string } {
  const t = (full || "").trim().replace(/\s+/g, " ");
  if (!t) return { first_name: "", last_name: "" };
  const parts = t.split(" ");
  const first_name = parts.shift() || "";
  const last_name = parts.join(" ");
  return { first_name, last_name };
}

/** UUID check */
export function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}
