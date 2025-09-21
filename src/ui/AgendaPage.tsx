// src/pages/Agenda.tsx
import React, { useEffect, useMemo, useState } from "react"

type RawAppointment = {
  id: string
  chair: number | string
  start_at?: string | null
  appointment_at?: string | null
  duration_min?: number | null
  patient_name?: string | null
  note?: string | null
  phone_e164?: string | null
  contact_id?: string | null
  contact?: {
    id: string
    first_name?: string | null
    last_name?: string | null
    phone_e164?: string | null
  } | null
}

type UiAppointment = {
  id: string
  chair: number
  start: string            // ISO UTC
  durationMin: number
  name: string
  phone?: string | null
  note?: string | null
  contactId?: string | null
}

const displayName = (a: RawAppointment) => {
  const full = [a.contact?.first_name, a.contact?.last_name]
    .filter(Boolean).join(" ").trim()
  return (
    a.patient_name ||
    full ||
    a.contact?.phone_e164 ||
    a.phone_e164 ||
    "Sconosciuto"
  )
}

const toUi = (a: RawAppointment): UiAppointment => {
  const effective = a.start_at ?? a.appointment_at
  if (!effective) {
    // fallback durissimo: porto ora per evitare buchi visuali
    const nowIso = new Date().toISOString()
    return {
      id: a.id,
      chair: Number(a.chair ?? 1),
      start: nowIso,
      durationMin: Number(a.duration_min ?? 30),
      name: displayName(a),
      phone: a.contact?.phone_e164 ?? a.phone_e164 ?? null,
      note: a.note ?? null,
      contactId: a.contact_id ?? a.contact?.id ?? null,
    }
  }
  return {
    id: a.id,
    chair: Number(a.chair ?? 1),
    start: effective,
    durationMin: Number(a.duration_min ?? 30),
    name: displayName(a),
    phone: a.contact?.phone_e164 ?? a.phone_e164 ?? null,
    note: a.note ?? null,
    contactId: a.contact_id ?? a.contact?.id ?? null,
  }
}

async function fetchAppointments(dayISO: string): Promise<UiAppointment[]> {
  const res = await fetch(`/.netlify/functions/appointments-by-day?date=${dayISO}`, {
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const items: RawAppointment[] = json.items ?? []
  return items.map(toUi)
}

// util
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const toRomeHHmm = (isoUtc: string) => {
  const d = new Date(isoUtc)
  const hh = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })
  return hh
}

// slot config
const DAY_START_MIN = 10 * 60   // 10:00
const DAY_END_MIN   = 20 * 60   // 20:00
const SLOT_MIN = 15

const minutesOfDayRome = (isoUtc: string) => {
  const d = new Date(isoUtc)
  const h = Number(d.toLocaleString("it-IT", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }))
  const m = Number(d.toLocaleString("it-IT", { minute: "2-digit", timeZone: "Europe/Rome" }))
  return h * 60 + m
}

const timeGrid = (stepMin: number) => {
  const out: string[] = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += stepMin) {
    const hh = Math.floor(m / 60), mm = m % 60
    out.push(`${pad2(hh)}:${pad2(mm)}`)
  }
  return out
}

export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = pad2(now.getMonth() + 1)
    const dd = pad2(now.getDate())
    return `${yyyy}-${mm}-${dd}`
  })
  const [items, setItems] = useState<UiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchAppointments(selectedDate)
      .then(list => { if (mounted) setItems(list) })
      .catch(e => { if (mounted) setError(String(e?.message || e)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selectedDate])

  const chair1 = useMemo(() => items.filter(i => i.chair === 1), [items])
  const chair2 = useMemo(() => items.filter(i => i.chair === 2), [items])
  const grid = useMemo(() => timeGrid(SLOT_MIN), [])

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>V Dental – Agenda &amp; Logs</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>
          Data{" "}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
        {loading && <span>Carico…</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Poltrona 1 */}
        <Column
          title="Poltrona 1"
          items={chair1}
        />
        {/* Poltrona 2 */}
        <Column
          title="Poltrona 2"
          items={chair2}
        />
      </div>

      {/* Griglia orari come legenda laterale opzionale */}
      <div style={{ marginTop: 16, opacity: 0.7 }}>
        <small>Fasce orarie ({SLOT_MIN} min): {grid.join(" • ")}</small>
      </div>
    </div>
  )
}

function Column({ title, items }: { title: string; items: UiAppointment[] }) {
  // ordina per orario effettivo (Roma)
  const sorted = [...items].sort((a, b) => {
    const ma = minutesOfDayRome(a.start)
    const mb = minutesOfDayRome(b.start)
    return ma - mb
  })

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{
        border: "1px dashed #ccc",
        borderRadius: 8,
        padding: 8,
        minHeight: 560,
        position: "relative",
      }}>
        {sorted.map(appt => (
          <Card key={appt.id} appt={appt} />
        ))}
        {sorted.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: "center", padding: 16 }}>
            Nessun appuntamento
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ appt }: { appt: UiAppointment }) {
  const topMin = Math.max(0, minutesOfDayRome(appt.start) - DAY_START_MIN)
  const heightMin = Math.max(SLOT_MIN, appt.durationMin || SLOT_MIN)

  // 1px = 1min (semplice); container minHeight ~ 560px per 10:00-20:00
  const px = (m: number) => m // se vuoi più compatto, usa m*0.8

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        top: px(topMin),
        height: px(heightMin),
        background: "#e6f7eb",
        border: "1px solid #bfe3c8",
        borderRadius: 8,
        padding: 8,
        overflow: "hidden",
      }}
      title={`${toRomeHHmm(appt.start)} • ${appt.durationMin} min`}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {appt.name}
      </div>
      <div style={{ fontSize: 12 }}>
        {toRomeHHmm(appt.start)} • {appt.durationMin} min
      </div>
      {appt.note && <div style={{ fontSize: 12, opacity: 0.8 }}>{appt.note}</div>}
    </div>
  )
}
