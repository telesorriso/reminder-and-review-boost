import React, { useState } from 'react'
import { AgendaPage } from './AgendaPage'
import { LogsPage } from './LogsPage'

type Tab = 'agenda' | 'logs'

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('agenda')

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, marginBottom: 8 }}>V Dental – Agenda &amp; Logs</h1>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('agenda')} disabled={tab === 'agenda'}>Agenda</button>
        <button onClick={() => setTab('logs')} disabled={tab === 'logs'}>Logs</button>
      </nav>

      {tab === 'agenda' && <AgendaPage />}
      {tab === 'logs' && <LogsPage />}
    </div>
  )
}
