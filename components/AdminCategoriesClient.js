'use client'

import { useEffect, useRef, useState } from 'react'
import { slugify } from '@/lib/utils'
import Link from 'next/link'
import { authFetchJson } from '@/utils/authFetch'

export default function AdminCategoriesClient() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedPois, setSelectedPois] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', description: '', sort_order: 0, is_active: true })
  const detailRef = useRef(null)

  async function load() {
    const data = await authFetchJson('/api/admin/categories')
    if (data.error) return setMessage(data.error)
    setItems(data.items || [])
  }

  async function loadPois(categoryId) {
    const d = await authFetchJson(`/api/admin/pending?category_id=${categoryId}&all=1`)
    if (d.error) return setMessage(d.error)
    setSelectedPois(d.items || [])
  }

  useEffect(() => { load() }, [])

  async function createCategory() {
    const data = await authFetchJson('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, slug: slugify(form.name), description: form.description, sort_order: Number(form.sort_order) || 0, is_active: form.is_active })
    })
    setMessage(data.error || 'Kategorie erstellt')
    setForm({ name: '', description: '', sort_order: 0, is_active: true })
    load()
  }

  async function saveSelected() {
    const data = await authFetchJson('/api/admin/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selected, slug: slugify(selected.name), sort_order: Number(selected.sort_order) || 0 })
    })
    setMessage(data.error || 'Kategorie gespeichert')
    load()
  }

  async function removeSelected() {
    const data = await authFetchJson(`/api/admin/categories?id=${selected.id}`, { method: 'DELETE' })
    setMessage(data.error || 'Kategorie gelöscht')
    setSelected(null)
    setSelectedPois([])
    load()
  }

  async function choose(item) {
    setSelected({ ...item })
    await loadPois(item.id)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <main className="container">
      <h1>Admin / Kategorien</h1>
      {message && <div className="notice">{message}</div>}
      <div className="grid grid-2">
        <div className="card">
          <h2>Neu</h2>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="label">Beschreibung</label>
          <textarea className="textarea" rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="label">Sortierung</label>
          <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          <label className="label"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> aktiv</label>
          <button className="btn" onClick={createCategory}>Anlegen</button>
        </div>

        <div className="grid">
          {items.map((item) => (
            <div key={item.id} className="card category-admin-card" onClick={() => choose(item)}>
              <div className="category-list-card">
                <strong>{item.name}</strong>
                <div className="category-count">{item.poi_count || 0}</div>
              </div>
              <p className="muted">{item.description || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      <div ref={detailRef} className="grid grid-2 jump-target" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Bearbeiten</h2>
          {selected ? (
            <>
              <label className="label">Name</label>
              <input className="input" value={selected.name || ''} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              <label className="label">Beschreibung</label>
              <textarea className="textarea" rows="4" value={selected.description || ''} onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
              <label className="label">Sortierung</label>
              <input className="input" type="number" value={selected.sort_order || 0} onChange={(e) => setSelected({ ...selected, sort_order: e.target.value })} />
              <label className="label"><input type="checkbox" checked={!!selected.is_active} onChange={(e) => setSelected({ ...selected, is_active: e.target.checked })} /> aktiv</label>
              <button className="btn" onClick={saveSelected}>Speichern</button>
              <button className="btn btn-danger" onClick={removeSelected} style={{ marginLeft: 8 }}>Löschen</button>
            </>
          ) : <p>Bitte eine Kategorie auswählen.</p>}
        </div>

        <div className="card">
          <h2>POIs dieser Kategorie</h2>
          {selectedPois.length ? selectedPois.map((poi) => (
            <Link key={poi.id} href={`/admin/poi/${poi.id}`} className="card" style={{ display: 'block', marginBottom: 10 }}>
              <strong>{poi.title}</strong>
              <p className="muted">{poi.status}</p>
              <p>Direkt zur Bearbeitung</p>
            </Link>
          )) : <p>Keine Datensätze geladen.</p>}
        </div>
      </div>
    </main>
  )
}
