
import React, { useEffect, useState } from 'react'
import { AgendaPage } from './AgendaPage'
import { LogsPage } from './LogsPage'

type Tab = 'agenda' | 'logs'

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('agenda')
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('admin_token') || ''
    if (saved) setToken(saved)
  }, [])

  const onSaveToken = () => {
    localStorage.setItem('admin_token', token)
    alert('Token salvato')
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>V Dental – Agenda & Logs</h1>
        <div>
          <input placeholder="Admin token" value={token} onChange={(e) => setToken(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <button onClick={onSaveToken}>Salva</button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('agenda')} disabled={tab === 'agenda'}>Agenda</button>
        <button onClick={() => setTab('logs')} disabled={tab === 'logs'}>Logs</button>
      </nav>

      {tab === 'agenda' && <AgendaPage getToken={() => token} />}
      {tab === 'logs' && <LogsPage getToken={() => token} />}
    </div>
  )
}
