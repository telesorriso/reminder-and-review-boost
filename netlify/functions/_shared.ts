// netlify/functions/_shared.ts
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

// ====== Env ======
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  // Durante il bundle non lanciare errori, ma a runtime le funzioni restituiranno 500 con messaggio chiaro
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

// ====== Supabase ======
export const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Quando usi fetch verso PostgREST
export const supaHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

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

// ====== Utilities ======
const TZ = "Europe/Rome";

export const romeToUtcISO = (dateLocal: string, timeLocal: string) => {
  // "2025-09-20", "10:15" -> UTC ISO
  const dt = DateTime.fromISO(`${dateLocal}T${timeLocal}`, { zone: TZ })
    .toUTC()
    .toISO();
  return dt!;
};

export const romeDayRangeUTC = (isoDate: string) => {
  // start e end (exclusive) del giorno in Europa/Roma ma convertiti in UTC ISO
  const start = DateTime.fromISO(`${isoDate}T00:00`, { zone: TZ })
    .toUTC()
    .toISO()!;
  const end = DateTime.fromISO(`${isoDate}T00:00`, { zone: TZ })
    .plus({ days: 1 })
    .toUTC()
    .toISO()!;
  return { start, end };
};

export const splitName = (full: string) => {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
};

export const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v || ""
  );
