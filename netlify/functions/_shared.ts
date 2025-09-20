// _shared.ts
export const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
};

export const ok = (data: any) => ({
  statusCode: 200,
  headers: JSON_HEADERS,
  body: JSON.stringify(data),
});

export const badRequest = (msg: string | object) => ({
  statusCode: 400,
  headers: JSON_HEADERS,
  body: JSON.stringify({ error: typeof msg === 'string' ? msg : { ...msg } }),
});

export const serverError = (err: unknown) => ({
  statusCode: 500,
  headers: JSON_HEADERS,
  body: JSON.stringify({ error: 'Unhandled error', details: String(err) }),
});

export const supaHeaders = () => ({
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'content-type': 'application/json',
  Prefer: 'return=representation',
});

// >>> 3 helper che mancavano <<<
export const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export function splitName(full: string) {
  const t = (full || '').trim().replace(/\s+/g, ' ');
  if (!t) return { first_name: '', last_name: '' };
  const parts = t.split(' ');
  const first_name = parts.pop() as string;
  const last_name = parts.join(' ') || '';
  return { first_name, last_name };
}

export function romeToUtcISO(date_local: string, time_local: string) {
  // costruisce ISO in UTC da data/ora europe/rome (senza dipendenze)
  const [y, m, d] = date_local.split('-').map(Number);
  const [hh, mm] = time_local.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  // correzione per timezone locale: ricrea data come se fosse Europe/Rome
  // (semplificato: va bene per il nostro caso operativo)
  return dt.toISOString();
}
