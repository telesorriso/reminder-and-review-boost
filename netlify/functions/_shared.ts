// netlify/functions/_shared.ts
// Helper condivisi per tutte le Netlify Functions

// ===== Env =====
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// ===== HTTP helpers (ritornano SEMPRE una Response valida) =====
export const json = (data: unknown, init: number | ResponseInit = 200) =>
  new Response(JSON.stringify(data), {
    status: typeof init === "number" ? init : init.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(typeof init === "number" ? {} : init),
  });

export const ok = (data: unknown) => json(data, 200);
export const badRequest = (message: string | object) =>
  json({ error: typeof message === "string" ? message : message }, 400);
export const serverError = (message: string | object) =>
  json({ error: typeof message === "string" ? message : message }, 500);

// ===== Supabase REST headers =====
export const supaHeaders = () => ({
  "Content-Type": "application/json",
  apiKey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
});

// ===== Utility: timezone Roma -> UTC =====
/**
 * Converte "2025-09-20T10:15" interpretato come Europe/Rome in ISO UTC.
 * Usa solo le API standard per evitare dipendenze.
 */
export function romeToUtcISO(dateLocal: string, timeLocal: string): string {
  // Costruiamo una data locale italiana (senza DST bug) usando Intl
  const [y, m, d] = dateLocal.split("-").map(Number);
  const [hh, mm] = timeLocal.split(":").map(Number);
  // Creiamo l'istante come se fosse ora locale di Roma:
  // trucco: costruiamo una stringa e lasciamo che il parser la interpreti in local,
  // poi correggiamo con timeZone = 'Europe/Rome' per ottenere il vero UTC.
  const local = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  // Format in that TZ and reparse as UTC ISO (più semplice: usiamo getTime)
  // In pratica l’ora già è UTC dell’istante equivalente; basta restituire toISOString
  return local.toISOString();
}

/**
 * Restituisce l’inizio/fine giorno **in UTC** corrispondenti a un YYYY-MM-DD in Europe/Rome
 * in formato ISO string (es. "2025-09-20T08:00:00.000Z", ...).
 */
export function romeDayRangeUTC(dateISO: string): { startUTC: string; endUTC: string } {
  // Consideriamo le 00:00 e 23:59:59 Europe/Rome, poi convertiamo a UTC
  const [y, m, d] = dateISO.split("-").map(Number);

  // start locale (Roma) -> costruito come UTC dello stesso wall time
  const startLocal = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const endLocal = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  return {
    startUTC: startLocal.toISOString(),
    endUTC: endLocal.toISOString(),
  };
}

// ===== Utility varie =====
export const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export function splitName(full: string): { first_name: string; last_name: string } {
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: parts[0] || "", last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts.slice(-1).join(" ") };
}
