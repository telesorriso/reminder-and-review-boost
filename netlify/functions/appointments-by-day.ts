import type { Handler } from '@netlify/functions';
import { supa, ok, badRequest, serverError, romeDayRangeUTC } from './_shared';
import { DateTime } from 'luxon';

const TZ = 'Europe/Rome';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

export const handler: Handler = async (event) => {
  try {
    // 1) Leggi e valida la data dalla query
    const raw = (event.queryStringParameters?.date || '').trim();

    const targetDate = DATE_RE.test(raw)
      ? raw
      : DateTime.now().setZone(TZ).toISODate()!; // fallback sicuro

    // 2) Calcola range UTC del giorno in Europa/Roma
    const { startUTC, endUTC } = romeDayRangeUTC(targetDate);

    // 3) Query su Supabase (appointments nella giornata)
    const { data, error } = await supa
      .from('appointments')
      .select('id, patient_name, phone_e164, appointment_at, duration_min, chair, status')
      .gte('appointment_at', startUTC)
      .lt('appointment_at', endUTC)
      .order('appointment_at', { ascending: true });

    if (error) return serverError(error.message);

    return ok({ appointments: data ?? [] });
  } catch (e: any) {
    return serverError(e?.message || 'Unhandled error');
  }
};
