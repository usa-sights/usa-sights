'use client'

import { useEffect, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'

const emptyForm = { id: '', name: '', slug: '', description: '', sort_order: 0, is_active: true }

export default function AdminCategoriesTableClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const d = await authFetchJson('/api/admin/categories')
    if (d.error) return setMessage(d.error)
    setItems(d.items || [])
  }

  useEffect(() => { load() }, [])

  async function saveCategory(e) {
    e.preventDefault()
    const method = form.id ? 'PUT' : 'POST'
    const d = await authFetchJson('/api/admin/categories', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sort_order: Number(form.sort_order || 0) }),
    })
    if (d.error) return setMessage(d.error)
    setMessage(form.id ? 'Kategorie gespeichert' : 'Kategorie angelegt')
    setForm(emptyForm)
    load()
  }

  async function removeCategory(id) {
    if (!window.confirm('Kategorie wirklich löschen?')) return
    const d = await authFetchJson(`/api/admin/categories?id=${id}`, { method: 'DELETE' })
    if (d.error) return setMessage(d.error)
    setMessage('Kategorie gelöscht')
    load()
  }

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Kategorien</h1>
      {message ? <div className="notice">{message}</div> : null}

      <form className="card" onSubmit={saveCategory} style={{ marginBottom: 12 }}>
        <h2>{form.id ? 'Kategorie bearbeiten' : 'Kategorie anlegen'}</h2>
        <div className="grid grid-2">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
        </div>
        <div className="grid grid-2">
          <div><label className="label">Sortierung</label><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
          <div><label className="label">Aktiv</label><select className="select" value={String(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">ja</option><option value="false">nein</option></select></div>
        </div>
        <label className="label">Beschreibung</label>
        <textarea className="textarea" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button className="btn" type="submit">{form.id ? 'Speichern' : 'Anlegen'}</button>
          {form.id ? <button className="btn btn-secondary" type="button" onClick={() => setForm(emptyForm)}>Abbrechen</button> : null}
        </div>
      </form>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Aktiv</th>
              <th>Sortierung</th>
              <th>POIs</th>
              <th>Beschreibung</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {items.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>{cat.slug}</td>
                <td>{cat.is_active ? 'ja' : 'nein'}</td>
                <td>{cat.sort_order}</td>
                <td>{cat.poi_count || 0}</td>
                <td>{cat.description || '-'}</td>
                <td>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button className="btn btn-secondary admin-mini-btn" onClick={() => setForm({ ...cat })}>Bearbeiten</button>
                    <button className="btn btn-danger admin-mini-btn" onClick={() => removeCategory(cat.id)}>Löschen</button>
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
