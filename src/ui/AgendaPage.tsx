
import React, { useEffect, useMemo, useState } from 'react'
import { DateTime, Interval } from 'luxon'

type Props = { getToken: () => string }
type Appointment = { id: string; patient_name: string; phone_e164: string; appointment_at: string; duration_min: number; chair: number; status: string }
type Contact = { id: string; first_name: string; last_name: string; phone_e164: string }

const TZ = 'Europe/Rome'

function toISODate(d: Date) {
  return DateTime.fromJSDate(d).setZone(TZ).toISODate()
}

export const AgendaPage: React.FC<Props> = ({ getToken }) => {
  const [date, setDate] = useState<string>(toISODate(new Date()))
  const [slotMin, setSlotMin] = useState<number>(15)
  const [appts, setAppts] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [modal, setModal] = useState<null | { chair: 1 | 2; time: string }>(null)

  const fetchAppts = async () => {
    const url = new URL('/.netlify/functions/appointments-by-day', window.location.origin)
    url.searchParams.set('date', date)
    const res = await fetch(url.toString(), { headers: { 'x-api-key': getToken() } })
    if (!res.ok) return alert(await res.text())
    const data = await res.json()
    setAppts(data.appointments || [])
  }

  const fetchContacts = async () => {
    const res = await fetch('/.netlify/functions/contacts-list', { headers: { 'x-api-key': getToken() } })
    if (!res.ok) return
    const data = await res.json()
    setContacts(data.contacts || [])
  }

  useEffect(() => { fetchAppts() }, [date])
  useEffect(() => { fetchContacts() }, [])

  const times = useMemo(() => {
    const out: string[] = []
    let t = DateTime.fromISO(`${date}T10:00`, { zone: TZ })
    const end = DateTime.fromISO(`${date}T20:00`, { zone: TZ })
    while (t <= end) {
      out.push(t.toFormat('HH:mm'))
      t = t.plus({ minutes: slotMin })
    }
    return out
  }, [date, slotMin])

  const openSlot = (chair: 1|2, time: string) => setModal({ chair, time })

  const isOccupied = (chair: number, time: string) => {
    const slotStartLocal = DateTime.fromISO(`${date}T${time}`, { zone: TZ })
    const slotStartUTC = slotStartLocal.toUTC()
    return appts.some(a => {
      if (a.chair !== chair) return false
      const start = DateTime.fromISO(a.appointment_at) // UTC in DB
      const end = start.plus({ minutes: a.duration_min })
      return Interval.fromDateTimes(start, end).contains(slotStartUTC)
    })
  }

  const saveAppointment = async (payload: any) => {
    const res = await fetch('/.netlify/functions/appointments-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': getToken() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) return alert(await res.text())
    setModal(null)
    fetchAppts()
    alert('Appuntamento creato e promemoria programmati ✅')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label>Data <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Dimensione slot
          <select value={slotMin} onChange={e => setSlotMin(Number(e.target.value))}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 8 }}>
        <div></div>
        <div style={{ textAlign: 'center', fontWeight: 600 }}>Poltrona 1</div>
        <div style={{ textAlign: 'center', fontWeight: 600 }}>Poltrona 2</div>
        {times.map((t) => (
          <React.Fragment key={t}>
            <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', paddingRight: 6 }}>{t}</div>
            {[1,2].map((chair) => {
              const occupied = isOccupied(chair as 1|2, t)
              return (
                <div key={chair} onClick={() => !occupied && openSlot(chair as 1|2, t)}
                  style={{
                    border: '1px dashed #ccc',
                    minHeight: 28,
                    background: occupied ? '#f5f5f5' : '#fff',
                    cursor: occupied ? 'not-allowed' : 'pointer',
                    borderRadius: 6,
                    padding: 4
                  }}>
                  {appts.filter(a => {
                    const startLocal = DateTime.fromISO(a.appointment_at).setZone(TZ).toFormat('HH:mm')
                    return a.chair === chair && startLocal === t
                  }).map(a => (
                    <div key={a.id} style={{ background: '#e8f5e9', border: '1px solid #b2dfdb', borderRadius: 6, padding: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{a.patient_name}</div>
                      <div style={{ fontSize: 12 }}>{t} • {a.duration_min} min</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {modal && (
        <NewApptModal
          date={date}
          chair={modal.chair}
          time={modal.time}
          contacts={contacts}
          onClose={() => setModal(null)}
          onSave={saveAppointment}
        />
      )}
    </div>
  )
}

const NewApptModal: React.FC<{
  date: string; chair: 1|2; time: string;
  contacts: Contact[];
  onClose: () => void;
  onSave: (payload: any) => void;
}> = ({ date, chair, time, contacts, onClose, onSave }) => {
  const [useContact, setUseContact] = useState(true)
  const [contactId, setContactId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+39')
  const [duration, setDuration] = useState(30)
  const [reviewDelay, setReviewDelay] = useState(2)

  const submit = () => {
    if (useContact && !contactId) return alert('Seleziona un contatto')
    if (!useContact && (!name || !phone)) return alert('Inserisci nome e telefono')
    const payload: any = {
      date_local: date,
      time_local: time,
      chair,
      duration_min: Math.max(15, duration),
      review_delay_hours: reviewDelay
    }
    if (useContact) payload.contact_id = contactId
    else { payload.patient_name = name; payload.phone_e164 = phone }
    onSave(payload)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Crea nuovo appuntamento</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, margin: '8px 0' }}>
          <label><input type="radio" checked={useContact} onChange={() => setUseContact(true)} /> Usa contatto</label>
          <label><input type="radio" checked={!useContact} onChange={() => setUseContact(false)} /> Inserisci manualmente</label>
        </div>

        {useContact ? (
          <label>Contatto
            <select value={contactId} onChange={e => setContactId(e.target.value)}>
              <option value="">— Scegli —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.last_name} {c.first_name} — {c.phone_e164}</option>
              ))}
            </select>
          </label>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            <label>Nome e cognome
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Mario Rossi" />
            </label>
            <label>Telefono (WhatsApp, E.164)
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39..." />
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
          <label>Poltrona
            <select value={String(chair)} onChange={() => {}} disabled>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label>Ora
            <input type="time" value={time} readOnly />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
          <label>Durata
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </label>
          <label>Review dopo
            <select value={reviewDelay} onChange={e => setReviewDelay(Number(e.target.value))}>
              <option value={2}>2 ore</option>
              <option value={24}>24 ore</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose}>Annulla</button>
          <button onClick={submit}>Salva</button>
        </div>
      </div>
    </div>
  )
}
