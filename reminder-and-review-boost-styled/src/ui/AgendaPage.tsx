import React, { useEffect, useMemo, useState } from "react"

// ---------- tipi backend ----------
type RawAppointment = {
  id: string
  chair: number | string
  appointment_at?: string | null
  duration_min?: number | null
  patient_name?: string | null
  note?: string | null
  phone_e164?: string | null
}
type UiAppointment = {
  id: string
  chair: number
  start: string
  durationMin: number
  name: string
  phone?: string | null
  note?: string | null
}

// ---------- utils ----------
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
  return a.patient_name || a.phone_e164 || "Sconosciuto"
}
const toUi = (a: RawAppointment): UiAppointment => {
  const start = a.appointment_at
  return {
    id: a.id,
    chair: Number(a.chair ?? 1),
    start: start ?? new Date().toISOString(),
    durationMin: Number(a.duration_min ?? 30),
    name: displayName(a),
    phone: a.phone_e164 ?? null,
    note: a.note ?? null,
  }
}
async function fetchAppointments(dayISO: string): Promise<UiAppointment[]> {
  const r = await fetch(`/.netlify/functions/appointments-by-day?date=${dayISO}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  const items: RawAppointment[] = j.items ?? []
  return items.map(toUi)
}

// ---------- layout ----------
const DAY_START_MIN = 9 * 60
const DAY_END_MIN = 20 * 60
const SLOT_MIN = 30

type Positioned = UiAppointment & {
  topMin: number
  heightMin: number
}

function layout(items: UiAppointment[]): Positioned[] {
  return items.map(a => {
    const startMin = minutesOfDayRome(a.start)
    const heightMin = Math.max(SLOT_MIN, a.durationMin || SLOT_MIN)
    return { ...a, topMin: startMin - DAY_START_MIN, heightMin }
  })
}

// ---------- Card ----------
function Card({ appt }: { appt: Positioned }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "4px",
        right: "4px",
        top: appt.topMin,
        height: appt.heightMin,
        background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        borderRadius: "12px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        color: "#fff",
        padding: "10px",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "14px" }}>{appt.name}</div>
      <div style={{ fontSize: "12px", opacity: 0.9 }}>{toRomeHHmm(appt.start)} • {appt.durationMin} min</div>
      {appt.note && <div style={{ fontSize: "12px", marginTop: 4 }}>{appt.note}</div>}
    </div>
  )
}

// ---------- Column ----------
function Column({ title, items, containerHeightPx }: { title:string; items:Positioned[]; containerHeightPx:number }) {
  return (
    <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", position:"relative" }}>
      <h3 style={{ marginBottom:8, color:"#1e293b" }}>{title}</h3>
      <div style={{ border:"1px solid #e2e8f0", borderRadius:12, background:"#fff", minHeight:containerHeightPx, position:"relative" }}>
        {items.map(appt => <Card key={appt.id} appt={appt} />)}
      </div>
    </div>
  )
}

// ---------- Page ----------
export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`
  })
  const [items, setItems] = useState<UiAppointment[]>([])

  useEffect(() => {
    fetchAppointments(selectedDate).then(setItems).catch(console.error)
  }, [selectedDate])

  const chair1 = useMemo(()=>layout(items.filter(i=>i.chair===1)), [items])
  const chair2 = useMemo(()=>layout(items.filter(i=>i.chair===2)), [items])
  const containerHeightPx = (DAY_END_MIN - DAY_START_MIN)

  return (
    <div style={{ padding: 24, fontFamily:"'Inter', sans-serif", background:"#f1f5f9", minHeight:"100vh" }}>
      <h1 style={{ marginBottom:16, fontSize:22, fontWeight:700, color:"#0f172a" }}>📅 Agenda – V Dental</h1>

      <div style={{ marginBottom:16 }}>
        <label style={{ fontWeight:600, color:"#334155" }}>Data: </label>
        <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <Column title="Poltrona 1" items={chair1} containerHeightPx={containerHeightPx} />
        <Column title="Poltrona 2" items={chair2} containerHeightPx={containerHeightPx} />
      </div>
    </div>
  )
}
