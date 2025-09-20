import type { Handler } from '@netlify/functions';
import {
  SUPABASE_URL, supaHeaders, ok, badRequest, serverError,
  romeToUtcISO, splitName, isUUID
} from './_shared';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'access-control-allow-origin': '*' } };
  if (event.httpMethod !== 'POST') return badRequest('Use POST');

  try {
    const body = JSON.parse(event.body || '{}');

    const { date_local, time_local, chair, duration_min, review_delay_hours } = body;
    if (!date_local || !time_local) return badRequest('Missing date_local/time_local');
    const appointment_at = romeToUtcISO(date_local, time_local);

    let patient_name = body.patient_name as string | undefined;
    let phone_e164 = body.phone_e164 as string | undefined;
    let contact_id = body.contact_id as string | undefined;

    // Se arriva un contact_id valido, ignora nome/telefono manuali
    if (contact_id && isUUID(contact_id)) {
      // ok, useremo il contatto esistente
    } else {
      // creazione manuale (o "salva come contatto")
      if (!patient_name || !phone_e164) return badRequest('Missing patient_name/phone_e164');
      if (body.save_contact) {
        const { first_name, last_name } = splitName(patient_name);
        const r = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
          method: 'POST',
          headers: supaHeaders(),
          body: JSON.stringify([{ first_name, last_name, phone_e164 }]),
        });
        if (!r.ok) return serverError(await r.text());
        const [created] = await r.json();
        contact_id = created?.id; // useremo questo
      }
    }

    // Crea l'appuntamento
    const apptPayload = [{
      contact_id: contact_id || null,
      patient_name: patient_name || null,
      phone_e164: phone_e164 || null,
      appointment_at,
      duration_min: duration_min ?? 30,
      chair: chair ?? 1,
      status: 'scheduled',
      review_delay_hours: review_delay_hours ?? 2,
    }];

    const resAppt = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify(apptPayload),
    });
    if (!resAppt.ok) return serverError(await resAppt.text());

    const [appt] = await resAppt.json();
    return ok({ success: true, appointment: appt });
  } catch (e) {
    return serverError(e);
  }
};
