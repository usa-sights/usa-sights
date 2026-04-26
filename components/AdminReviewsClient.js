'use client'

import { useEffect, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'

const emptyForm = { id: '', rating: 5, review_text: '' }

export default function AdminReviewsClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const params = new URLSearchParams(window.location.search)
    const d = await authFetchJson('/api/admin/reviews?' + params.toString())
    if (d.error) return setMessage(d.error)
    setItems(d.items || [])
  }

  useEffect(() => { load() }, [])

  async function saveReview(e) {
    e.preventDefault()
    const d = await authFetchJson('/api/admin/reviews', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (d.error) return setMessage(d.error)
    setMessage('Review gespeichert')
    setForm(emptyForm)
    load()
  }

  async function rejectReview(id) {
    if (!window.confirm('Review wirklich rejecten/löschen?')) return
    const d = await authFetchJson(`/api/admin/reviews?id=${id}`, { method: 'DELETE' })
    if (d.error) return setMessage(d.error)
    setMessage('Review entfernt')
    load()
  }

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Reviews</h1>
      {message ? <div className="notice">{message}</div> : null}

      <form className="card" onSubmit={saveReview} style={{ marginBottom: 12 }}>
        <h2>{form.id ? 'Review bearbeiten' : 'Review auswählen'}</h2>
        <div className="grid grid-2">
          <div><label className="label">Rating</label><input className="input" type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
          <div><label className="label">Review-ID</label><input className="input" value={form.id} readOnly /></div>
        </div>
        <label className="label">Text</label>
        <textarea className="textarea" rows="4" value={form.review_text} onChange={(e) => setForm({ ...form, review_text: e.target.value })} />
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button className="btn" type="submit" disabled={!form.id}>Speichern</button>
          {form.id ? <button className="btn btn-secondary" type="button" onClick={() => setForm(emptyForm)}>Abbrechen</button> : null}
        </div>
      </form>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead><tr><th>Datum</th><th>POI</th><th>Rating</th><th>Text</th><th>Aktion</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{String(item.created_at).slice(0,10)}</td>
                <td>{item.pois?.title || '-'}</td>
                <td>{item.rating}</td>
                <td>{item.review_text || '-'}</td>
                <td>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button className="btn btn-secondary admin-mini-btn" onClick={() => setForm({ id: item.id, rating: item.rating, review_text: item.review_text || '' })}>Bearbeiten</button>
                    <button className="btn btn-danger admin-mini-btn" onClick={() => rejectReview(item.id)}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
