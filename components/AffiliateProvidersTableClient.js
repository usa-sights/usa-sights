'use client'

import { useEffect, useState } from 'react'
import { authFetchJson, authFetch } from '@/utils/authFetch'

const emptyForm = { provider_key: '', provider_name: '', is_global_enabled: true, sort_order: 0 }

export default function AffiliateProvidersTableClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const d = await authFetchJson('/api/admin/affiliate-providers')
    if (d.error) return setMessage(d.error)
    setItems(d.items || [])
  }

  useEffect(() => { load() }, [])

  async function saveProvider(e) {
    e.preventDefault()
    const d = await authFetchJson('/api/admin/affiliate-providers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sort_order: Number(form.sort_order || 0) }),
    })
    if (d.error) return setMessage(d.error)
    setMessage('Affiliate-Provider gespeichert')
    setForm(emptyForm)
    load()
  }

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Affiliate Anbieter</h1>
      {message ? <div className="notice">{message}</div> : null}

      <form className="card" onSubmit={saveProvider} style={{ marginBottom: 12 }}>
        <h2>{form.provider_key && items.find((x) => x.provider_key === form.provider_key) ? 'Affiliate-Provider bearbeiten' : 'Affiliate-Provider anlegen'}</h2>
        <div className="grid grid-2">
          <div><label className="label">Key</label><input className="input" value={form.provider_key} onChange={(e) => setForm({ ...form, provider_key: e.target.value })} required /></div>
          <div><label className="label">Name</label><input className="input" value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} required /></div>
        </div>
        <div className="grid grid-2">
          <div><label className="label">Sortierung</label><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
          <div><label className="label">Global aktiv</label><select className="select" value={String(form.is_global_enabled)} onChange={(e) => setForm({ ...form, is_global_enabled: e.target.value === 'true' })}><option value="true">ja</option><option value="false">nein</option></select></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button className="btn" type="submit">Speichern</button>
          {form.provider_key ? <button className="btn btn-secondary" type="button" onClick={() => setForm(emptyForm)}>Reset</button> : null}
        </div>
      </form>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Global aktiv</th>
              <th>Sortierung</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.provider_key}>
                <td>{item.provider_key}</td>
                <td>{item.provider_name}</td>
                <td>{item.is_global_enabled ? 'ja' : 'nein'}</td>
                <td>{item.sort_order}</td>
                <td><button className="btn btn-secondary admin-mini-btn" onClick={() => setForm({ ...item })}>Bearbeiten</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
