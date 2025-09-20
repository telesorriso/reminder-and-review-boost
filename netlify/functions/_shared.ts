// netlify/functions/_shared.ts

// --- Costanti/env -----------------------------------------------------------
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --- Helpers HTTP -----------------------------------------------------------
export const json = (status: number, body: unknown) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

// 200 OK
export const ok = (body: unknown) => json(200, body);

// 400 Bad Request
export const badRequest = (message: string | object) =>
  json(400, typeof message === 'string' ? { error: message } : message);

// 500 Server Error
export const serverError = (err: unknown) => {
  const details =
    err instanceof Error ? { message: err.message, stack: err.stack } : err;
  return json(500, { error: 'Unhandled error', details });
};

// --- Supabase fetch headers -------------------------------------------------
export const supaHeaders = () => ({
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'content-type': 'application/json',
});

// --- Utility varie ----------------------------------------------------------

// Converte una data locale Europa/Roma + ora HH:mm in ISO UTC per il DB
export const romeToUtcISO = (dateLocal: string, timeLocal: string) => {
  // evitiamo dipendenze: calcolo semplice con offset italiano
  // ATTENZIONE: è sufficiente per il nostro caso (oggi/quest’anno)
  const [h, m] = timeLocal.split(':').map(Number);
  const d = new Date(`${dateLocal}T${timeLocal}:00+02:00`); // CE(S)T
  // Normalizzo a UTC ISO
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes()
    )
  ).toISOString();
};

// Split "Mario Rossi" => { first_name: "Mario", last_name: "Rossi" }
export const splitName = (full: string) => {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  const last_name = parts.pop() as string;
  const first_name = parts.join(' ');
  return { first_name, last_name };
};

// Controllo UUID (v4)
export const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s || ''
  );
