// src/ui/AgendaPage.tsx
import React, { useEffect, useMemo, useState } from "react"

/* ---------- tipi backend ---------- */
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
  start: string
  durationMin: number
  name: string
  phone?: string | null
  note?: string | null
  contactId?: string | null
}
type Contact = {
  id: string
  first_name?: string | null
  last_name?: string | null
  phone_e164?: string | null
}

/* ---------- utils ---------- */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const toRomeHHmm = (isoUtc: string) =>
  new Date(isoUtc).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome", hour12: false })

const minutesOfDayRome = (isoUtc: string) => {
  const d = new Date(isoUtc)
  const h = Number(d.toLocaleString("it-IT", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }))
  const m = Number(d.toLocaleString("it-IT", { minute: "2-digit", timeZone: "Europe/Rome" }))
  return h * 60 + m
}

const displayName = (a: RawAppointment) => {
  const full = [a.contact?.first_name, a.contact?.last_name].filter(Boolean).join(" ").trim()
  return a.patient_name || full || a.contact?.phone_e164 || a.phone_e164 || "Sconosciuto"
}
const toUi = (a: RawAppointment): UiAppointment => {
  const start = a.start_at ?? a.appointment_at
  return {
    id: a.id,
    chair: Number(a.chair ?? 1),
    start: start ?? new Date().toISOString(),
    durationMin: Number(a.duration_min ?? 30),
    name: displayName(a),
    phone: a.contact?.phone_e164 ?? a.phone_e164 ?? null,
    note: a.note ?? null,
    contactId: a.contact_id ?? a.contact?.id ?? null,
  }
}
async function fetchAppointments(dayISO: string): Promise<UiAppointment[]> {
  const r = await fetch(`/.netlify/functions/appointments-by-day?date=${dayISO}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  const items: RawAppointment[] = j.items ?? []
  return items.map(toUi)
}

/* ---------- agenda layout ---------- */
const DAY_START_MIN = 10 * 60
const DAY_END_MIN = 20 * 60
const SLOT_MIN = 15

type Positioned = UiAppointment & {
  topMin: number
  heightMin: number
  lane: number
  laneCount: number
}

function layoutWithLanes(items: UiAppointment[]): Positioned[] {
  const sorted = [...items].sort((a, b) => minutesOfDayRome(a.start) - minutesOfDayRome(b.start))
  type Active = { appt: Positioned; endMin: number }
  const out: Positioned[] = []
  let active: Active[] = []
  const flush = () => {
    if (!active.length) return
    const lanes = Math.max(...active.map(a => a.appt.lane)) + 1
    active.forEach(a => { a.appt.laneCount = lanes; out.push(a.appt) })
    active = []
  }
  for (const appt of sorted) {
    const startMin = minutesOfDayRome(appt.start)
    const heightMin = Math.max(SLOT_MIN, appt.durationMin || SLOT_MIN)
    const endMin = startMin + heightMin
    const latestEnd = active.reduce((m, a) => Math.max(m, a.endMin), -1)
    if (active.length && startMin >= latestEnd) flush()
    const used = new Set(active.map(a => a.appt.lane))
    let lane = 0; while (used.has(lane)) lane++
    const positioned: Positioned = { ...appt, topMin: Math.max(0, startMin - DAY_START_MIN), heightMin, lane, laneCount: 1 }
    active = active.filter(a => a.endMin > startMin)
    active.push({ appt: positioned, endMin })
  }
  flush()
  return out
}

/* ---------- time rail ---------- */
function TimeRail() {
  const labels: string[] = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += SLOT_MIN) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0")
    const mm = String(m % 60).padStart(2, "0")
    labels.push(`${hh}:${mm}`)
  }
  return (
    <div style={{ position: "relative", width: 64 }}>
      {labels.map((t, i) => (
        <div key={t} style={{ position: "absolute", top: i * SLOT_MIN, transform: "translateY(-50%)", fontSize: 12, color: "#666" }}>
          {t}
        </div>
      ))}
      <div style={{ height: (DAY_END_MIN - DAY_START_MIN) }} />
    </div>
  )
}

/* ---------- colonne & card ---------- */
function Column({
  title, items, containerHeightPx, onSlotClick,
}: { title:string; items:Positioned[]; containerHeightPx:number; onSlotClick:(hhmm:string)=>void }) {
  const slots = useMemo(() => {
    const out: { top:number; label:string }[] = []
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MIN) {
      const hh = Math.floor(m/60), mm = m % 60
      const label = `${pad2(hh)}:${pad2(mm)}`
      out.push({ top: m - DAY_START_MIN, label })
    }
    return out
  }, [])

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div
        style={{
          position: "relative",
          border: "1px dashed #ccc",
          borderRadius: 8,
          padding: 0,
          minHeight: containerHeightPx,
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 15px)",
          backgroundPosition: "0 0",
          backgroundRepeat: "repeat-y",
          backgroundSize: "100% 15px",
        }}
      >
        {slots.map((s) => (
          <button
            key={s.label}
            onClick={() => onSlotClick(s.label)}
            title={`Nuovo alle ${s.label}`}
            style={{
              position: "absolute",
              left: 4,
              right: 4,
              top: s.top,
              height: SLOT_MIN,
              background: "transparent",
              border: "1px dashed rgba(0,0,0,0.05)",
              borderRadius: 6,
              cursor: "pointer",
              zIndex: 1,
            }}
            aria-label={`Crea appuntamento alle ${s.label}`}
          />
        ))}
        {items.map((appt) => <Card key={appt.id} appt={appt} />)}
        {items.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: "center", padding: 16 }}>
            Clicca uno slot per creare un appuntamento
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ appt }: { appt: Positioned }) {
  const GAP_PX = 6
  const lanes = Math.max(1, appt.laneCount)
  const lane = Math.max(0, Math.min(appt.lane, lanes - 1))
  const widthPct = 100 / lanes
  const leftPct = (lane * 100) / lanes

  return (
    <div
      style={{
        position: "absolute",
        left: `calc(${leftPct}% + ${GAP_PX / 2}px)`,
        width: `calc(${widthPct}% - ${GAP_PX}px)`,
        top: appt.topMin,
        height: appt.heightMin,
        background: "#e6f7eb",
        border: "1px solid #bfe3c8",
        borderRadius: 8,
        padding: 8,
        overflow: "hidden",
        boxSizing: "border-box",
        zIndex: 2,
      }}
      title={`${toRomeHHmm(appt.start)} • ${appt.durationMin} min`}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{appt.name}</div>
      <div style={{ fontSize: 12 }}>
        {toRomeHHmm(appt.start)} • {appt.durationMin} min
      </div>
      {appt.note && <div style={{ fontSize: 12, opacity: 0.8 }}>{appt.note}</div>}
    </div>
  )
}

/* ---------- pagina ---------- */
export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`
  })
  const [items, setItems] = useState<UiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true); setError(null)
    fetchAppointments(selectedDate)
      .then(list => { if (live) setItems(list) })
      .catch(e => { if (live) setError(String(e?.message||e)) })
      .finally(()=> { if (live) setLoading(false) })
    return () => { live = false }
  }, [selectedDate])

  const chair1 = useMemo(()=>layoutWithLanes(items.filter(i=>i.chair===1)), [items])
  const chair2 = useMemo(()=>layoutWithLanes(items.filter(i=>i.chair===2)), [items])
  const containerHeightPx = Math.max(
    ...[...chair1, ...chair2].map(p => p.topMin + p.heightMin),
    DAY_END_MIN - DAY_START_MIN
  )

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>V Dental – Agenda &amp; Logs</h1>

      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <label>Data <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} /></label>
        {loading && <span>Carico…</span>}
        {error && <span style={{ color:"crimson" }}>{error}</span>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"64px 1fr 1fr", gap:16 }}>
        <TimeRail />
        <Column title="Poltrona 1" items={chair1} containerHeightPx={containerHeightPx} onSlotClick={()=>{}} />
        <Column title="Poltrona 2" items={chair2} containerHeightPx={containerHeightPx} onSlotClick={()=>{}} />
      </div>
    </div>
  )
}
