
import { DateTime } from 'luxon'

export const TZ = 'Europe/Rome'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function checkAuth(headers: Record<string, string | string[] | undefined>) {
  const sent = (headers['x-api-key'] || headers['X-Api-Key'] || '') as string
  const token = process.env.ADMIN_TOKEN || ''
  return !!token && sent === token
}

export function localToUTC(dateLocal: string, timeLocal: string) {
  const dt = DateTime.fromISO(`${dateLocal}T${timeLocal}`, { zone: TZ })
  return dt.toUTC()
}

export function formatLocal(dtUTC: string) {
  return DateTime.fromISO(dtUTC, { zone: 'utc' }).setZone(TZ).toFormat('dd/LL/yyyy HH:mm')
}

export function computeSchedules(appointmentAtUTC: DateTime, reviewDelayHours: number) {
  const local = appointmentAtUTC.setZone(TZ)
  const dayBefore18Local = local.minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).toUTC()
  const sameDayMinus3h = local.minus({ hours: 3 }).toUTC()
  const review = local.plus({ hours: reviewDelayHours }).toUTC()
  return {
    dayBefore18UTC: dayBefore18Local.toISO(),
    sameDayMinus3hUTC: sameDayMinus3h.toISO(),
    reviewUTC: review.toISO(),
  }
}
