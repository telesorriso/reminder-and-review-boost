// netlify/functions/_shared.ts
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

// ====== costanti/env ======
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TZ = "Europe/Rome";

// ====== supabase client ======
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ====== HTTP helpers ======
export const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const badRequest = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });

export const serverError = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

export const badRequest = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });

export const serverError = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

// ====== standard headers per chiamate REST a Supabase ======
export const supaHeaders = () => ({
  apiKey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});

// Alias di compatibilità: alcuni file importano ancora "supa"
export const supa = supaHeaders;

// ====== utilità date/time ======

/**
 * Dato un giorno "YYYY-MM-DD" (ora locale Roma),
 * ritorna l'intervallo in UTC ISO per [00:00, 24:00) di quel giorno.
 * Ritorna sia {start,end} che {from,to} per compatibilità.
 */
export function romeDayRangeUTC(dateISO: string): {
  start: string;
  end: string;
  from: string;
  to: string;
} {
  const startLocal = DateTime.fromISO(`${dateISO}T00:00`, { zone: TZ });
  const endLocal = startLocal.plus({ days: 1 });

  const start = startLocal.toUTC().toISO();
  const end = endLocal.toUTC().toISO();

  return { start: start!, end: end!, from: start!, to: end! };
}

/**
 * Converte una coppia data/ora locali di Roma in un timestamp ISO UTC.
 * @param dateLocal "YYYY-MM-DD"
 * @param timeLocal "HH:mm"
 */
export function romeToUtcISO(dateLocal: string, timeLocal: string): string {
  const dtLocal = DateTime.fromISO(`${dateLocal}T${timeLocal}`, { zone: TZ });
  return dtLocal.toUTC().toISO()!;
}

// ====== utilità nomi/validazioni ======

/**
 * Spezza "Mario Rossi" -> { first_name: "Mario", last_name: "Rossi" }
 * Se c'è un solo token, va in first_name.
 */
export function splitName(full: string): { first_name: string; last_name: string } {
  const trimmed = (full || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { first_name: "", last_name: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts.slice(-1)[0] };
}

/** Verifica se una stringa è un UUID v4 valido */
export function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
