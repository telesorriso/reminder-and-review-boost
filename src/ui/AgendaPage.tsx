// src/ui/AgendaPage.tsx
import React, { useEffect, useMemo, useState } from "react"

/* ---------- tipi ---------- */
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
  start: string            // ISO UTC (campo unico per posizionamento)
  durationMin: number
  name: string
  phone?: string | null
  note?: string | null
  contactId?: string | null
}

/* ---------- normalizzazione dati ---------- */
const displayName = (a: RawAppointment) => {
  const full = [a.contact?.first_name, a.contact?.last_name].filter(Boolean).join(" ").trim()
  return a.patient_name || full || a.contact?.phone_e164 || a.phone_e164 || "Sconosciuto"
}

const toUi = (a: RawAppointment): UiAppointment => {
  const start = a.start_at ?? a.appointment_at
  return {
    id: a.id,
    chair: Number(a.chair ?? 1),
    start: start ?? new Date().toISOString(), // fallback difensivo
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

/* ---------- util orari/roma ---------- */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const toRomeHHmm = (isoUtc: string) =>
  new Date(isoUtc).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
    hour12: false,
  })

const minutesOfDayRome = (isoUtc: string) => {
  const d = new Date(isoUtc)
  const h = Number(d.toLocaleString("it-IT", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }))
  const m = Number(d.toLocaleString("it-IT", { minute: "2-digit", timeZone: "Europe/Rome" }))
  return h * 60 + m
}

/* ---------- configurazione griglia ---------- */
const DAY_START_MIN = 10 * 60 // 10:00
const DAY_END_MIN   = 20 * 60 // 20:00
const SLOT_MIN      = 15

const timeGrid = (stepMin: number) => {
  const out: string[] = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += stepMin) {
    const hh = Math.floor(m / 60), mm = m % 60
    out.push(`${pad2(hh)}:${pad2(mm)}`)
  }
  return out
}

/* ---------- layout con gestione sovrapposizioni (lane) ---------- */
type Positioned = UiAppointment & {
  topMin: number     // distanza dall'inizio giornata (minuti)
  heightMin: number  // durata (minuti)
  lane: number       // corsia assegnata (0..laneCount-1)
  laneCount: number  // numero corsie del cluster
}

// Algoritmo: sweep-line per cluster di appuntamenti che si sovrappongono.
// Ogni cluster ottiene n corsie. Ogni appuntamento ha lane e laneCount.
function layoutWithLanes(items: UiAppointment[]): Positioned[] {
  // ordina per inizio
  const sorted = [...items].sort((a, b) => {
    const ma = minutesOfDayRome(a.start), mb = minutesOfDayRome(b.start)
    return ma - mb
  })

  type Active = { appt: Positioned, endMin: number }
  const result: Positioned[] = []
  let active: Active[] = []

  const flushCluster = () => {
    if (active.length === 0) return
    // calcola quante corsie usate max
    const lanes = Math.max(...active.map(a => a.appt.lane)) + 1
    active.forEach(a => { a.appt.laneCount = lanes; result.push(a.appt) })
    active = []
  }

  for (const appt of sorted) {
    const startMin = minutesOfDayRome(appt.start)
    const heightMin = Math.max(SLOT_MIN, appt.durationMin || SLOT_MIN)
    const endMin = startMin + heightMin

    // chiudi cluster se questo non si sovrappone al precedente attivo più “tardo”
    const latestEnd = active.reduce((mx, a) => Math.max(mx, a.endMin), -1)
    if (active.length > 0 && startMin >= latestEnd) {
      flushCluster()
    }

    // assegna la lane più bassa libera
    const used = new Set(active.map(a => a.appt.lane))
    let lane = 0
    while (used.has(lane)) lane++

    const positioned: Positioned = {
      ...appt,
      topMin: Math.max(0, startMin - DAY_START_MIN),
      heightMin,
      lane,
      laneCount: 1, // valorizzata a fine cluster
    }

    // rimuovi da active quelli che sono già finiti prima dell'inizio corrente
    active = active.filter(a => a.endMin > startMin)
    active.push({ appt: positioned, endMin })
  }

  // flush finale
  flushCluster()
  return result
}

/* ---------- componente pagina ---------- */
export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  })
  const [items, setItems] = useState<UiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true); setError(null)
    fetchAppointments(selectedDate)
      .then(list => { if (mounted) setItems(list) })
      .catch(e => { if (mounted) setError(String(e?.message || e)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selectedDate])

  const chair1 = useMemo(() => layoutWithLanes(items.filter(i => i.chair === 1)), [items])
  const chair2 = useMemo(() => layoutWithLanes(items.filter(i => i.chair === 2)), [items])

  // calcolo altezza contenitore: fine più tardi tra entrambe le poltrone
  const lastEndMin = Math.max(
    ...[...chair1, ...chair2].map(p => p.topMin + p.heightMin),
    DAY_END_MIN - DAY_START_MIN
  )
  const containerHeightPx = lastEndMin // 1px = 1min (semplice)

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
        <Column title="Poltrona 1" items={chair1} containerHeightPx={containerHeightPx} />
        <Column title="Poltrona 2" items={chair2} containerHeightPx={containerHeightPx} />
      </div>

      <div style={{ marginTop: 16, opacity: 0.7 }}>
        <small>Fasce orarie ({SLOT_MIN} min): {grid.join(" • ")}</small>
      </div>
    </div>
  )
}

/* ---------- componenti di colonna e card ---------- */
function Column({ title, items, containerHeightPx }: { title: string; items: Positioned[]; containerHeightPx: number }) {
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div
        style={{
          border: "1px dashed #ccc",
          borderRadius: 8,
          padding: 8,
          minHeight: containerHeightPx,
          position: "relative",
        }}
      >
        {items.map(appt => (
          <Card key={appt.id} appt={appt} />
        ))}

        {items.length === 0 && (
          <div style={{ opacity: 0.5, textAlign: "center", padding: 16 }}>
            Nessun appuntamento
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ appt }: { appt: Positioned }) {
  // corsie: dividiamo lo spazio orizzontale tra appuntamenti che si sovrappongono
  const gap = 6 // px
  const widthPct = (100 - (appt.laneCount - 1) * (gap / 2)) / appt.laneCount
  const leftPct = appt.lane * widthPct + (appt.lane * (gap / 2) * 100) / 100 // piccolo gap visivo

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: appt.topMin,
        height: appt.heightMin,
        background: "#e6f7eb",
        border: "1px solid #bfe3c8",
        borderRadius: 8,
        padding: 8,
        overflow: "hidden",
        boxSizing: "border-box",
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
