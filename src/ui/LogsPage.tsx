import React, { useEffect, useState } from 'react'
import { DateTime } from 'luxon'

type Msg = {
  id: string
  appointment_id: string
  type: string
  scheduled_at?: string | null
  sent_at?: string | null
  status: string
  last_error?: string | null
}

const fmt = (iso?: string | null) => {
  if (!iso) return ''
  try {
    return DateTime.fromISO(iso).setZone('Europe/Rome').toFormat('dd/MM HH:mm')
  } catch {
    return iso || ''
  }
}

export const LogsPage: React.FC = () => {
  const [rows, setRows] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRows = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/.netlify/functions/messages-list')
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      setRows(Array.isArray(j.items) ? j.items : [])
    } catch (e: any) {
      setError(String(e?.message || e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  return (
    <div>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
        <button onClick={fetchRows} disabled={loading}>{loading ? 'Aggiorno…' : 'Aggiorna'}</button>
        {error && <span style={{ color:'crimson' }}>{error}</span>}
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:8 }}>Tipo</th>
              <th style={{ textAlign:'left', padding:8 }}>Schedulato</th>
              <th style={{ textAlign:'left', padding:8 }}>Inviato</th>
              <th style={{ textAlign:'left', padding:8 }}>Stato</th>
              <th style={{ textAlign:'left', padding:8 }}>Errore</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop:'1px solid #eee' }}>
                <td style={{ padding:8 }}>{r.type}</td>
                <td style={{ padding:8 }}>{fmt(r.scheduled_at)}</td>
                <td style={{ padding:8 }}>{fmt(r.sent_at)}</td>
                <td style={{ padding:8 }}>{r.status}</td>
                <td style={{ padding:8, color: r.last_error ? 'crimson' : undefined }}>{r.last_error || ''}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={5} style={{ padding:12, opacity:0.7 }}>Nessun messaggio</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
