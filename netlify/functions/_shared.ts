// netlify/functions/_shared.ts
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --- HTTP helpers: DEVONO restituire una Response ---
export const ok = (data: any, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });

export const badRequest = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

export const serverError = (err: unknown) =>
  new Response(
    JSON.stringify({
      error: "Unhandled error",
      details:
        err instanceof Error ? err.message : typeof err === "string" ? err : err,
    }),
    { status: 500, headers: { "content-type": "application/json" } }
  );

// --- Supabase client con Service Role (solo lato server) ---
export const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- Utility: Rome -> UTC ISO / validazioni ---
export const TZ = "Europe/Rome";

export const romeDayRangeUTC = (dateISO: string) => {
  const start = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  const end = start.plus({ days: 1 });
  return { startUTC: start.toUTC().toISO(), endUTC: end.toUTC().toISO() };
};

export const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );

export const splitName = (full: string) => {
  const t = (full || "").trim().replace(/\s+/g, " ");
  if (!t) return { first: "", last: "" };
  const parts = t.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.slice(-1)[0] };
};
