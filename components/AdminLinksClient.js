'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Pencil, Save, Trash2, CheckCircle2, Clock3, XCircle, Search } from 'lucide-react'
import { authFetchJson } from '@/utils/authFetch'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
}

export default function AdminLinksClient() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ label: '', url: '', status: 'pending' })
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [query, setQuery] = useState('')

  async function load() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (query.trim()) params.set('q', query.trim())
    const data = await authFetchJson(`/api/admin/links?${params.toString()}`)
    if (data.error) return setMessage(data.error)
    setItems(data.items || [])
  }

  useEffect(() => {
    load().catch((e) => setMessage(e.message))
  }, [statusFilter])

  const filteredItems = useMemo(() => items, [items])

  async function saveItem(id) {
    const data = await authFetchJson('/api/admin/links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...draft }),
    })
    if (data.error) return setMessage(data.error)
    setItems((prev) => prev.map((item) => item.id === id ? data.item : item))
    setEditingId(null)
    setMessage('Link gespeichert.')
  }

  async function updateStatus(id, status) {
    const current = items.find((item) => item.id === id)
    if (!current) return
    const data = await authFetchJson('/api/admin/links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label: current.label, url: current.url, status }),
    })
    if (data.error) return setMessage(data.error)
    setItems((prev) => prev.map((item) => item.id === id ? data.item : item))
    setMessage(`Status auf ${status} gesetzt.`)
  }

  async function removeItem(id) {
    const data = await authFetchJson(`/api/admin/links?id=${id}`, { method: 'DELETE' })
    if (data.error) return setMessage(data.error)
    setItems((prev) => prev.filter((item) => item.id !== id))
    setMessage('Link gelöscht.')
  }

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Links</h1>
      {message ? <div className="notice">{message}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div>
            <label className="label">Status filtern</label>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Alle</option>
              <option value="pending">pending</option>
              <option value="published">published</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div>
            <label className="label">Suche</label>
            <div className="input-with-icon">
              <Search size={16} />
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Label oder URL" />
              <button type="button" className="btn btn-secondary" onClick={() => load()}>Suchen</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>POI</th>
              <th>Status</th>
              <th>Label</th>
              <th>URL</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id
              return (
                <tr key={item.id}>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    {item.pois?.slug ? <Link href={`/poi/${item.pois.slug}`}>{item.pois?.title || '-'}</Link> : (item.pois?.title || '-')}
                  </td>
                  <td>
                    {isEditing ? (
                      <select className="select" value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="pending">pending</option>
                        <option value="published">published</option>
                        <option value="rejected">rejected</option>
                      </select>
                    ) : <span className={`status-pill status-${item.status}`}>{item.status}</span>}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="input" value={draft.label} onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))} />
                    ) : (item.label || '-')}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="input" value={draft.url} onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))} />
                    ) : <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {isEditing ? (
                        <button type="button" className="btn btn-secondary" onClick={() => saveItem(item.id)}><Save size={16} /> Speichern</button>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(item.id); setDraft({ label: item.label || '', url: item.url || '', status: item.status || 'pending' }) }}><Pencil size={16} /> Bearbeiten</button>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => updateStatus(item.id, 'published')}><CheckCircle2 size={16} /> Publish</button>
                      <button type="button" className="btn btn-secondary" onClick={() => updateStatus(item.id, 'pending')}><Clock3 size={16} /> Pending</button>
                      <button type="button" className="btn btn-danger" onClick={() => updateStatus(item.id, 'rejected')}><XCircle size={16} /> Reject</button>
                      <button type="button" className="btn btn-danger" onClick={() => removeItem(item.id)}><Trash2 size={16} /> Löschen</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filteredItems.length ? (
              <tr><td colSpan="6"><div className="muted">Keine Links gefunden.</div></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  )
}
