import React, { useEffect, useMemo, useState } from "react"

/** ===================
 *  Types from backend
 *  =================== */
type RawAppointment = {
  id: string
  chair: number | string
  appointment_at?: string | null
  start_at?: string | null
  duration_min?: number | null
  patient_name?: string | null
  phone_e164?: string | null
  note?: string | null
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
  start: string       // ISO UTC
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

/** ===================
 *  Time helpers
 *  =================== */
const TZ = "Europe/Rome"
const DAY_START_H = 10
const DAY_END_H = 20

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)

const toRomeHHmm = (isoUtc: string) =>
  new Date(isoUtc).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  })

const minutesOfDayRome = (isoUtc: string) => {
  const d = new Date(isoUtc)
  const hh = Number(
    d.toLocaleString("it-IT", { hour: "2-digit", hour12: false, timeZone: TZ })
  )
  const mm = Number(d.toLocaleString("it-IT", { minute: "2-digit", timeZone: TZ }))
  return hh * 60 + mm
}

const toISODateLocalRome = (d: Date) => {
  // yyyy-mm-dd expressed in Europe/Rome calendar date
  const y = Number(d.toLocaleString("it-IT", { year: "numeric", timeZone: TZ }))
  const m = Number(d.toLocaleString("it-IT", { month: "2-digit", timeZone: TZ }))
  const day = Number(d.toLocaleString("it-IT", { day: "2-digit", timeZone: TZ }))
  return `${y}-${pad2(m)}-${pad2(day)}`
}

/** ===================
 *  Mapping helpers
 *  =================== */
const displayName = (a: RawAppointment) => {
  const full = [a.contact?.first_name, a.contact?.last_name].filter(Boolean).join(" ").trim()
  return a.patient_name || full || a.contact?.phone_e164 || a.phone_e164 || "Sconosciuto"
}
const toUi = (a: RawAppointment): UiAppointment => {
  const start = a.start_at ?? a.appointment_at ?? new Date().toISOString()
  return {
    id: a.id,
    chair: Number(a.chair ?? 1),
    start,
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
  const items: RawAppointment[] = j.items ?? j.appointments ?? []
  return items.map(toUi)
}

/** ===================
 *  Layout helpers
 *  =================== */
const PX_PER_MIN = 2  // << the SINGLE source of truth for vertical scale
const DAY_START_MIN = DAY_START_H * 60
const DAY_END_MIN = DAY_END_H * 60
const DAY_TOTAL_MIN = DAY_END_MIN - DAY_START_MIN
const CONTAINER_HEIGHT = DAY_TOTAL_MIN * PX_PER_MIN

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
    const clampedStart = Math.max(DAY_START_MIN, startMin)
    const heightMin = Math.max(15, appt.durationMin || 15)
    const endMin = startMin + heightMin
    const latestEnd = active.reduce((m, a) => Math.max(m, a.endMin), -1)
    if (active.length && startMin >= latestEnd) flush()

    const used = new Set(active.map(a => a.appt.lane))
    let lane = 0; while (used.has(lane)) lane++

    const positioned: Positioned = {
      ...appt,
      topMin: clampedStart - DAY_START_MIN,
      heightMin,
      lane,
      laneCount: 1,
    }
    active = active.filter(a => a.endMin > startMin)
    active.push({ appt: positioned, endMin })
  }
  flush()
  return out
}

/** ===================
 *  Create modal
 *  =================== */
type CreatePayload = {
  dentist_id: string
  chair: number
  date: string
  time: string
  duration_min: number
  contact_id?: string | null
  patient_name?: string | null
  phone_e164?: string | null
  note?: string | null
}

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

function CreateModal({
  visible, onClose, onSaved, date, chair, timeHHmm,
}: {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  date: string
  chair: 1 | 2
  timeHHmm: string
}) {
  const [mode, setMode] = useState<"contact"|"manual">("contact")
  const [query, setQuery] = useState("")
  const debouncedQ = useDebounced(query)
  const [results, setResults] = useState<Contact[]>([])
  const [selected, setSelected] = useState<Contact | null>(null)
  const [duration, setDuration] = useState(30)
  const [note, setNote] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setErr(null); setSelected(null); setResults([]); setQuery(""); setName(""); setPhone(""); setNote("")
    setDuration(30); setMode("contact")
  }, [visible, chair, timeHHmm])

  useEffect(() => {
    if (!visible || mode !== "contact") return
    const q = debouncedQ.trim()
    if (!q) { setResults([]); return }
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch(`/.netlify/functions/contacts-list?q=${encodeURIComponent(q)}`)
        const j = await r.json()
        if (!cancel) setResults(Array.isArray(j.items) ? j.items as Contact[] : [])
      } catch {
        if (!cancel) setResults([])
      }
    })()
    return () => { cancel = true }
  }, [debouncedQ, mode, visible])

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
        note: note || null,
      }
      if (mode === "contact") {
        if (!selected) throw new Error("Seleziona un contatto")
        payload.contact_id = selected.id
      } else {
        payload.patient_name = name || null
        payload.phone_e164 = phone || null
        if (!payload.patient_name && !payload.phone_e164) {
          throw new Error("Inserisci almeno nome o telefono")
        }
      }
      const res = await fetch("/.netlify/functions/appointments-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 10, padding: 16, width: 520, maxWidth: "92vw", boxShadow: "0 14px 40px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Crea nuovo appuntamento</h3>
        <div style={{ marginBottom: 8 }}>Poltrona: <b>{chair}</b> • Ora: <b>{timeHHmm}</b> • Data: <b>{date}</b></div>

        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <label><input type="radio" checked={mode==="contact"} onChange={()=>setMode("contact")} /> Usa contatto</label>
          <label><input type="radio" checked={mode==="manual"} onChange={()=>setMode("manual")} /> Inserisci manualmente</label>
        </div>

        <form onSubmit={onSubmit}>
          {mode === "contact" ? (
            <div style={{ marginBottom: 12 }}>
              <input
                placeholder="Cerca contatto (nome, cognome o telefono)"
                value={query}
                onChange={(e)=>{ setQuery(e.target.value); setSelected(null) }}
                style={{ width: "100%" }}
              />
              {!!results.length && !selected && (
                <div style={{ border:"1px solid #eee", borderRadius:6, marginTop:6, maxHeight:200, overflow:"auto" }}>
                  {results.map(c => {
                    const nm = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "(senza nome)"
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={()=>setSelected(c)}
                        style={{ display:"flex", width:"100%", textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #f3f3f3", background:"#fff", cursor:"pointer" }}
                      >
                        <div style={{ flex:1 }}>{nm}</div>
                        <div style={{ color:"#666" }}>{c.phone_e164 || ""}</div>
                      </button>
                    )
                  })}
                </div>
              )}
              {selected && (
                <div style={{ marginTop: 6, padding: 8, background:"#f7f7f7", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{[selected.first_name, selected.last_name].filter(Boolean).join(" ").trim() || "(senza nome)"}</div>
                    <div style={{ fontSize:12, color:"#666" }}>{selected.phone_e164 || ""}</div>
                  </div>
                  <button type="button" onClick={()=>setSelected(null)}>Cambia</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Nome paziente
                <input value={name} onChange={(e)=>setName(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Telefono (E.164, es. +39333...)
                <input value={phone} onChange={(e)=>setPhone(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
          )}

          <div style={{ display:"flex", gap:12, marginBottom: 12 }}>
            <label>
              Durata{" "}
              <select value={duration} onChange={(e)=>setDuration(Number(e.target.value))}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>
            <label style={{ flex:1 }}>
              Note
              <textarea value={note} onChange={(e)=>setNote(e.target.value)} rows={3} style={{ width: "100%" }} />
            </label>
          </div>

          {err && <div style={{ color:"crimson", marginBottom: 8 }}>{err}</div>}

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} disabled={saving}>Annulla</button>
            <button type="submit" disabled={saving}>{saving ? "Salvo…" : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** ===================
 *  Time Rail
 *  =================== */
function TimeRail({ slotMin }: { slotMin: number }) {
  const labels: {top:number, text:string}[] = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 30) {
    const hh = Math.floor(m/60), mm = m % 60
    labels.push({ top: (m - DAY_START_MIN) * PX_PER_MIN, text: `${pad2(hh)}:${pad2(mm)}` })
  }
  return (
    <div style={{ position:"relative", width: 72 }}>
      {/* full height spacer */}
      <div style={{ height: CONTAINER_HEIGHT }} />
      {labels.map((l) => (
        <div key={l.text} style={{ position:"absolute", left:0, right:0, top:l.top, transform:"translateY(-50%)", fontSize:12, color:"#333" }}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/** ===================
 *  Column + Card
 *  =================== */
function Column({
  title, items, slotMin, onSlotClick,
}: { title:string; items:Positioned[]; slotMin:number; onSlotClick:(hhmm:string)=>void }) {

  // background grid: bold black line at each slot boundary
  const bg = `repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0.15) 0px,
    rgba(0,0,0,0.15) 1px,
    transparent 1px,
    transparent ${slotMin * PX_PER_MIN}px
  )`

  // clickable slots
  const slots = useMemo(() => {
    const out: { topPx:number; label:string }[] = []
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += slotMin) {
      const hh = Math.floor(m/60), mm = m % 60
      out.push({ topPx: (m - DAY_START_MIN) * PX_PER_MIN, label: `${pad2(hh)}:${pad2(mm)}` })
    }
    return out
  }, [slotMin])

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div
        style={{
          position:"relative",
          border:"1px dashed #cfcfcf",
          borderRadius: 10,
          padding: 8,
          height: CONTAINER_HEIGHT,
          background: bg,
          overflow: "hidden",
        }}
      >
        {/* Clickable area per-slot */}
        {slots.map(s => (
          <button
            key={s.label}
            onClick={() => onSlotClick(s.label)}
            title={`Nuovo alle ${s.label}`}
            style={{
              position:"absolute",
              left: 8, right: 8,
              top: s.topPx,
              height: slotMin * PX_PER_MIN,
              background:"transparent",
              border:"none",
              cursor:"pointer",
              zIndex: 1,
            }}
            aria-label={`Crea appuntamento alle ${s.label}`}
          />
        ))}

        {/* Cards */}
        {items.map(appt => <Card key={appt.id} appt={appt} />)}

        {items.length === 0 && (
          <div style={{ position:"absolute", left:0, right:0, top:"45%", textAlign:"center", opacity:0.6 }}>
            Clicca uno slot per creare un appuntamento
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ appt }: { appt:Positioned }) {
  const gap = 6 // px between lanes
  const widthCalc = `calc((100% - ${(appt.laneCount - 1) * gap}px) / ${appt.laneCount})`
  const leftCalc = `calc((${widthCalc} + ${gap}px) * ${appt.lane})`

  return (
    <div
      style={{
        position:"absolute",
        left: leftCalc, width: widthCalc,
        top: appt.topMin * PX_PER_MIN,
        height: appt.heightMin * PX_PER_MIN,
        background:"#e6f7eb",
        border:"1px solid #bfe3c8",
        borderRadius:8,
        padding:8,
        overflow:"hidden",
        boxSizing:"border-box",
        zIndex:2,
      }}
      title={`${toRomeHHmm(appt.start)} • ${appt.durationMin} min`}
    >
      <div style={{ fontWeight:600, marginBottom:4, textTransform:"capitalize" }}>{appt.name}</div>
      <div style={{ fontSize:12 }}>{toRomeHHmm(appt.start)} • {appt.durationMin} min</div>
      {appt.note && <div style={{ fontSize:12, opacity:0.8 }}>{appt.note}</div>}
    </div>
  )
}

/** ===================
 *  Page
 *  =================== */
export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(toISODateLocalRome(new Date()))
  const [slotMin, setSlotMin] = useState<number>(30)
  const [items, setItems] = useState<UiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{open:boolean, chair:1|2, timeHHmm:string}>({
    open:false, chair:1, timeHHmm:"10:00"
  })

  const reload = () => {
    setLoading(true); setError(null)
    fetchAppointments(selectedDate)
      .then(setItems)
      .catch(e => setError(String(e?.message || e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [selectedDate])

  const chair1 = useMemo(()=>layoutWithLanes(items.filter(i=>i.chair===1)), [items])
  const chair2 = useMemo(()=>layoutWithLanes(items.filter(i=>i.chair===2)), [items])

  const openNewAt = (chair:1|2, hhmm:string) => {
    const w:any = window
    if (typeof w.openCreateAppointment === "function") {
      w.openCreateAppointment({ chair, time: hhmm, date: selectedDate, onSaved: reload }); return
    }
    if (typeof w.openNewAppointment === "function") {
      w.openNewAppointment(chair, hhmm, selectedDate, reload); return
    }
    if (typeof w.appointmentNew === "function") {
      w.appointmentNew({ chair, time: hhmm, date: selectedDate, onSaved: reload }); return
    }
    setModal({ open:true, chair, timeHHmm: hhmm })
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>V Dental – Agenda &amp; Logs</h1>

      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <label>Data{" "}
          <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} />
        </label>
        <label>Dimensione slot{" "}
          <select value={slotMin} onChange={(e)=>setSlotMin(Number(e.target.value))}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
        {loading && <span>Carico…</span>}
        {error && <span style={{ color:"crimson" }}>{error}</span>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"72px 1fr 1fr", gap:16 }}>
        <TimeRail slotMin={slotMin} />
        <Column title="Poltrona 1" items={chair1} slotMin={slotMin} onSlotClick={(hhmm)=>openNewAt(1, hhmm)} />
        <Column title="Poltrona 2" items={chair2} slotMin={slotMin} onSlotClick={(hhmm)=>openNewAt(2, hhmm)} />
      </div>

      <CreateModal
        visible={modal.open}
        onClose={()=>setModal(m=>({...m, open:false}))}
        onSaved={reload}
        date={selectedDate}
        chair={modal.chair}
        timeHHmm={modal.timeHHmm}
      />
    </div>
  )
}

export default AgendaPage