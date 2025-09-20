// netlify/functions/_shared.ts
import { createClient } from "@supabase/supabase-js";

// ===== Env =====
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client Supabase (service role) – SOLO lato Netlify Functions
export const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== Response helpers =====
export const ok = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" }, ...init });

export const badRequest = (msg: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify({ error: typeof msg === "string" ? msg : msg }), { status: 400, headers: { "content-type": "application/json" }, ...init });

export const serverError = (err: unknown, init: ResponseInit = {}) => {
  const payload =
    err instanceof Error ? { error: "Unhandled error", details: err.message } : { error: "Unhandled error", details: err };
  return new Response(JSON.stringify(payload), { status: 500, headers: { "content-type": "application/json" }, ...init });
};

// ===== Utilities usate dalle altre funzioni =====
export const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export const splitName = (full: string) => {
  const t = (full || "").trim().replace(/\s+/g, " ");
  if (!t) return { first_name: "", last_name: "" };
  const parts = t.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  const last_name = parts.pop() as string;
  const first_name = parts.join(" ");
  return { first_name, last_name };
};

// Converte data/ora locali (Europe/Rome) in ISO UTC per DB
export const romeToUtcISO = (date_local: string, time_local: string) => {
  // niente dipendenze: parsing semplice HH:mm
  const [h, m] = (time_local || "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(`${date_local}T00:00:00+01:00`); // base a Roma
  // Aggiungi offset ora/min locali
  d.setHours(d.getHours() + h, d.getMinutes() + m, 0, 0);
  // Ritorna in UTC ISO
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
};
