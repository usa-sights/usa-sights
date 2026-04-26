'use client'

import { useEffect, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'

export default function AdminAffiliateProvidersClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')

  async function load() {
    const data = await authFetchJson('/api/admin/affiliate-providers')
    if (data.error) return setMessage(data.error)
    setItems(data.items || [])
  }

  useEffect(() => { load() }, [])

  async function saveItem(item) {
    const data = await authFetchJson('/api/admin/affiliate-providers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    setMessage(data.error || `${item.provider_name} gespeichert`)
    if (!data.error) load()
  }

  return (
    <main className="container">
      <h1>Admin / Affiliate Anbieter</h1>
      {message ? <div className="notice">{message}</div> : null}
      <div className="grid" style={{ gap: 10 }}>
        {items.map((item) => (
          <div key={item.provider_key} className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 220px 120px 140px', gap: 12, alignItems: 'end' }}>
              <div>
                <label className="label">Name</label>
                <input className="input" value={item.provider_name || ''} onChange={(e) => setItems((prev) => prev.map((x) => x.provider_key === item.provider_key ? { ...x, provider_name: e.target.value } : x))} />
              </div>
              <div>
                <label className="label">Key</label>
                <input className="input" value={item.provider_key || ''} readOnly />
              </div>
              <div>
                <label className="label">Sort</label>
                <input className="input" type="number" value={item.sort_order ?? 0} onChange={(e) => setItems((prev) => prev.map((x) => x.provider_key === item.provider_key ? { ...x, sort_order: Number(e.target.value || 0) } : x))} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label><input type="checkbox" checked={!!item.is_global_enabled} onChange={(e) => setItems((prev) => prev.map((x) => x.provider_key === item.provider_key ? { ...x, is_global_enabled: e.target.checked } : x))} /> aktiv</label>
                <button className="btn btn-secondary" onClick={() => saveItem(item)}>Speichern</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
