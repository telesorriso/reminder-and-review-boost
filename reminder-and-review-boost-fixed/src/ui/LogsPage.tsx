
import React, { useEffect, useState } from 'react'
import { DateTime } from 'luxon'

type Props = { getToken: () => string }
type Msg = { id: string; appointment_id: string; type: string; scheduled_at: string; sent_at?: string; status: string; last_error?: string }

export const LogsPage: React.FC<Props> = ({ getToken }) => {
  const [rows, setRows] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/messages-list', {
        headers: { 'x-api-key': getToken() }
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRows(data.messages || [])
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  const fmt = (iso?: string) => iso ? DateTime.fromISO(iso).setZone('Europe/Rome').toFormat('dd/LL/yyyy HH:mm') : '-'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2>Logs invii</h2>
        <button onClick={fetchRows} disabled={loading}>{loading ? 'Aggiorno...' : 'Aggiorna'}</button>
      </div>
      <div style={{ border: '1px solid #ddd', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Programmato</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Inviato</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Stato</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Errore</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.type}</td>
                <td style={{ padding: 8 }}>{fmt(r.scheduled_at)}</td>
                <td style={{ padding: 8 }}>{fmt(r.sent_at)}</td>
                <td style={{ padding: 8 }}>{r.status}</td>
                <td style={{ padding: 8, color: r.last_error ? 'red' : undefined }}>{r.last_error || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
