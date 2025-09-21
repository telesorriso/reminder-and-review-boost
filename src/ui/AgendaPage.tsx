// src/ui/AgendaPage.tsx
import React, { useEffect, useMemo, useState } from "react"

/* ---------- tipi dal backend ---------- */
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
  start: string            // ISO UTC (unico timestamp per posizionamento)
  durationMin: number
  name: string
  phone?: string | null
  note?: string | null
  contactId?: string | null
}

/* ---------- normalizzazione ---------- */
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

/* ---------- util orari / Rome ---------- */
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

/* ---------- layout con corsie (anti-sovrapposizione) ---------- */
type Positioned = UiAppointment & {
  topMin: number
  heightMin: number
  lane: number
  laneCount: number
}

function layoutWithLanes(items: UiAppointment[]): Positioned[] {
  const sorted = [...items].sort((a, b) => {
    const ma = minutesOfDayRome(a.start), mb = minutesOfDayRome(b.start)
    return ma - mb
  })

  type Active = { appt: Positioned, endMin: number }
  const result: Positioned[] = []
  let active: Active[] = []

  const flushCluster = () => {
    if (!active.length) return
    const lanes = Math.max(...active.map(a => a.appt.lane)) + 1
    active.forEach(a => { a.appt.laneCount = lanes; result.push(a.appt) })
    active = []
  }

  for (const appt of sorted) {
    const startMin = minutesOfDayRome(appt.start)
    const heightMin = Math.max(SLOT_MIN, appt.durationMin || SLOT_MIN)
    const endMin = startMin + heightMin

    const latestEnd = active.reduce((mx, a) => Math.max(mx, a.endMin), -1)
    if (active.length > 0 && startMin >= latestEnd) flushCluster()

    const used = new Set(active.map(a => a.appt.lane))
    let lane = 0
    while (used.has(lane)) lane++

    const positioned: Positioned = {
      ...appt,
      topMin: Math.max(0, startMin - DAY_START_MIN),
      heightMin,
      lane,
      laneCount: 1,
    }

    active = active.filter(a => a.endMin > startMin)
    active.push({ appt: positioned, endMin })
  }

  flushCluster()
  return result
}

/* ---------- time rail (scala oraria a sinistra) ---------- */
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
        <div
          key={t}
          style={{
            position: "absolute",
            top: i * SLOT_MIN,     // 1px = 1min
            transform: "translateY(-50%)",
            fontSize: 12,
            color: "#666",
          }}
        >
          {t}
        </div>
      ))}
      <div style={{ height: (DAY_END_MIN - DAY_START_MIN) }} />
    </div>
  )
}

/* ---------- MODALE FALLBACK (se non esiste la tua) ---------- */
type CreatePayload = {
  dentist_id: string
  chair: number
  date: string        // YYYY-MM-DD
  time: string        // HH:mm
  duration_min: number
  patient_name?: string | null
  note?: string | null
  contact_id?: string | null
  phone_e164?: string | null
}

function CreateModal({
  visible,
  onClose,
  onSaved,
  date,
  chair,
  timeHHmm,
}: {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  date: string
  chair: 1 | 2
  timeHHmm: string
}) {
  const [name, setName] = useState("")
  const [duration, setDuration] = useState(30)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setName("")
      setDuration(30)
      setNote("")
      setErr(null)
    }
  }, [visible, chair, timeHHmm])

  if (!visible) return null

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      const payload: CreatePayload = {
        dentist_id: "main",
        chair,
        date,
        time: timeHHmm,
        duration_min: duration,
        patient_name: name || null,
        note: note || null,
      }
      const res = await fetch("/.netlify/functions/appointments-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 8, padding: 16, width: 420, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Crea nuovo appuntamento</h3>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 8 }}>Poltrona: <b>{chair}</b> • Ora: <b>{timeHHmm}</b> • Data: <b>{date}</b></div>

          <label style={{ display: "block", marginBottom: 8 }}>
            Nome paziente (opzionale)
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Durata
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>

          {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={saving}>Annulla</button>
            <button type="submit" disabled={saving}>{saving ? "Salvo…" : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------- colonna con slot + card ---------- */
function Column({
  title,
  items,
  containerHeightPx,
  onSlotClick,
}: {
  title: string
  items: Positioned[]
  containerHeightPx: number
  onSlotClick: (hhmm: string) => void
}) {
  const slots = useMemo(() => {
    const out: { top: number; label: string }[] = []
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MIN) {
      const hh = Math.floor(m / 60), mm = m % 60
      out.push({ top: m - DAY_START_MIN, label: `${pad2(hh)}:${pad2(mm)}` })
    }
    return out
  }, [])

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
        {/* slot trasparenti cliccabili */}
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
              border: "1px dashed rgba(0,0,0,0.06)",
              borderRadius: 6,
              cursor: "pointer",
              zIndex: 1, // sotto le card
            }}
            aria-label={`Crea appuntamento alle ${s.label}`}
          />
        ))}

        {/* card appuntamenti */}
        {items.map(appt => (
          <Card key={appt.id} appt={appt} />
        ))}

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
  const gap = 6
  const widthPct = (100 - (appt.laneCount - 1) * (gap / 2)) / appt.laneCount
  const leftPct = appt.lane * widthPct + (appt.lane * (gap / 2) * 100) / 100

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
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  })
  const [items, setItems] = useState<UiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // stato modale fallback
  const [fallbackModal, setFallbackModal] = useState<{open:boolean, chair:1|2, timeHHmm:string}>({
    open: false, chair: 1, timeHHmm: "10:00"
  })

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

  const lastEndMin = Math.max(
    ...[...chair1, ...chair2].map(p => p.topMin + p.heightMin),
    DAY_END_MIN - DAY_START_MIN
  )
  const containerHeightPx = lastEndMin

  const reload = () => {
    fetchAppointments(selectedDate).then(setItems).catch(console.error)
  }

  // collega slot al TUO popup; se non esiste → usa modale fallback
  const openNewAt = (chair: 1 | 2, hhmm: string) => {
    const w: any = window
    if (typeof w.openCreateAppointment === "function") {
      w.openCreateAppointment({ chair, time: hhmm, date: selectedDate, onSaved: reload })
      return
    }
    if (typeof w.openNewAppointment === "function") {
      w.openNewAppointment(chair, hhmm, selectedDate, reload)
      return
    }
    if (typeof w.appointmentNew === "function") {
      w.appointmentNew({ chair, time: hhmm, date: selectedDate, onSaved: reload })
      return
    }
    // fallback locale
    setFallbackModal({ open: true, chair, timeHHmm: hhmm })
  }

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

      <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr", gap: 16 }}>
        <TimeRail />
        <Column
          title="Poltrona 1"
          items={chair1}
          containerHeightPx={containerHeightPx}
          onSlotClick={(hhmm) => openNewAt(1, hhmm)}
        />
        <Column
          title="Poltrona 2"
          items={chair2}
          containerHeightPx={containerHeightPx}
          onSlotClick={(hhmm) => openNewAt(2, hhmm)}
        />
      </div>

      {/* Modale fallback, usata solo se non troviamo funzioni globali */}
      <CreateModal
        visible={fallbackModal.open}
        onClose={() => setFallbackModal(m => ({ ...m, open: false }))}
        onSaved={reload}
        date={selectedDate}
        chair={fallbackModal.chair}
        timeHHmm={fallbackModal.timeHHmm}
      />
    </div>
  )
}
