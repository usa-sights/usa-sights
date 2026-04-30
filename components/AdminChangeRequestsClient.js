'use client'
import { useEffect, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'

export default function AdminChangeRequestsClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')

  async function load() {
    const data = await authFetchJson('/api/admin/change-requests')
    if (data.error) return setMessage(data.error)
    setItems(data.items || [])
  }

  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    const data = await authFetchJson('/api/admin/change-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    setMessage(data.error || 'Status geändert')
    load()
  }

  return (
    <main className="container">
      <h1>Admin / Änderungsvorschläge</h1>
      {message && <div className="notice">{message}</div>}
      <div className="grid">
        {items.map((item) => (
          <div key={item.id} className="card">
            <strong>{item.pois?.title || 'POI'}</strong>
            <p><strong>Feld:</strong> {item.field_name}</p>
            <p><strong>Vorschlag:</strong> {item.new_value}</p>
            <p><strong>Status:</strong> {item.status}</p>
            <button className="btn" onClick={() => setStatus(item.id, 'approved')}>Annehmen</button>
            <button className="btn btn-danger" onClick={() => setStatus(item.id, 'rejected')} style={{ marginLeft: 8 }}>Ablehnen</button>
          </div>
        ))}
      </div>
    </main>
  )
}
