'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { authFetchJson } from '@/utils/authFetch'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import StatusBadge from '@/components/StatusBadge'

const sorters = {
  title: (a, b) => String(a.title || '').localeCompare(String(b.title || '')),
  status: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
  category: (a, b) => String(a.categories?.name || '').localeCompare(String(b.categories?.name || '')),
  city: (a, b) => String(a.city || '').localeCompare(String(b.city || '')),
  state: (a, b) => String(a.state || '').localeCompare(String(b.state || '')),
  created_at: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  updated_at: (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
}

export default function AdminPOIsClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [states, setStates] = useState([])
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stateValue, setStateValue] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [missing, setMissing] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, limit: 50, has_more: false })
  const [pageSize, setPageSize] = useState(50)
  const [sortKey, setSortKey] = useState('updated_at')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkStatus, setBulkStatus] = useState('published')
  const [bulkBusy, setBulkBusy] = useState(false)

  async function load(next = {}) {
    const nextStatus = next.status ?? status
    const nextQ = next.q ?? q
    const nextCategoryId = next.categoryId ?? categoryId
    const nextState = next.stateValue ?? stateValue
    const nextUser = next.userQuery ?? userQuery
    const nextMissing = next.missing ?? missing
    const nextPage = next.page ?? page
    const nextPageSize = next.pageSize ?? pageSize

    const params = new URLSearchParams({
      status: nextStatus,
      q: nextQ,
      category_id: nextCategoryId,
      state: nextState,
      user: nextUser,
      missing: nextMissing,
      limit: String(nextPageSize),
      offset: String((nextPage - 1) * nextPageSize),
    })
    const data = await authFetchJson(`/api/admin/pois?${params.toString()}`)
    if (data.error) return setMessage(data.error)

    setItems(data.items || [])
    setSelectedIds((prev) => prev.filter((id) => (data.items || []).some((item) => item.id === id)))
    setMeta({ total: data.total || 0, limit: data.limit || nextPageSize, has_more: !!data.has_more })
  }

  useEffect(() => {
    async function init() {
      const url = new URL(window.location.href)
      const initialMissing = url.searchParams.get('missing') || ''
      const initialStatus = url.searchParams.get('status') || 'all'
      setMissing(initialMissing)
      setStatus(initialStatus)

      const { data: cats } = await supabase.from('categories').select('id,name').order('sort_order')
      setCategories(cats || [])
      const statesData = await authFetchJson('/api/admin/pois?status=all&limit=200&offset=0')
      setStates(Array.from(new Set((statesData.items || []).map((x) => x.state).filter(Boolean))).sort())
      await load({ page: 1, missing: initialMissing, status: initialStatus })
    }
    init()
  }, [supabase])

  useEffect(() => {
    if (page !== 1) load({ page })
  }, [page])

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || pageSize || 50)))
  const sortedItems = [...items].sort(sorters[sortKey] || sorters.updated_at)
  const selectedCount = selectedIds.length
  const allVisibleSelected = sortedItems.length > 0 && sortedItems.every((poi) => selectedIds.includes(poi.id))
  const someVisibleSelected = sortedItems.some((poi) => selectedIds.includes(poi.id))

  function applyAndReset() {
    setPage(1)
    load({ page: 1, pageSize })
  }

  function changePageSize(nextPageSize) {
    setPageSize(nextPageSize)
    setPage(1)
    load({ page: 1, pageSize: nextPageSize })
  }


  function toggleSelected(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function toggleVisible(checked) {
    const visibleIds = sortedItems.map((poi) => poi.id).filter(Boolean)
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ...visibleIds]))
      return prev.filter((id) => !visibleIds.includes(id))
    })
  }

  async function bulkChangeStatus() {
    if (!selectedIds.length || bulkBusy) return
    const ok = window.confirm(`Status für ${selectedIds.length} markierte POI${selectedIds.length === 1 ? '' : 's'} auf "${bulkStatus}" ändern?`)
    if (!ok) return
    setBulkBusy(true)
    setMessage('')
    const failed = []
    for (const id of selectedIds) {
      const data = await authFetchJson(`/api/admin/pois/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: bulkStatus }),
      })
      if (data.error) failed.push(data.error)
    }
    setBulkBusy(false)
    if (failed.length) {
      setMessage(`${failed.length} POI${failed.length === 1 ? '' : 's'} konnten nicht aktualisiert werden: ${failed[0]}`)
      await load()
      return
    }
    setItems((prev) => prev.map((x) => selectedIds.includes(x.id) ? { ...x, status: bulkStatus } : x))
    setSelectedIds([])
    setMessage(`Status für ${selectedIds.length} POI${selectedIds.length === 1 ? '' : 's'} gespeichert`)
  }

  async function bulkDeletePois() {
    if (!selectedIds.length || bulkBusy) return
    const ok = window.confirm(`${selectedIds.length} markierte POI${selectedIds.length === 1 ? '' : 's'} wirklich vollständig löschen?`)
    if (!ok) return
    setBulkBusy(true)
    setMessage('')
    const idsToDelete = [...selectedIds]
    const failed = []
    for (const id of idsToDelete) {
      const data = await authFetchJson(`/api/admin/pois/${id}`, { method: 'DELETE' })
      if (data.error) failed.push(data.error)
    }
    setBulkBusy(false)
    if (failed.length) {
      setMessage(`${failed.length} POI${failed.length === 1 ? '' : 's'} konnten nicht gelöscht werden: ${failed[0]}`)
      await load()
      return
    }
    setItems((prev) => prev.filter((x) => !idsToDelete.includes(x.id)))
    setSelectedIds([])
    setMessage(`${idsToDelete.length} POI${idsToDelete.length === 1 ? '' : 's'} gelöscht`)
  }

  async function changeStatus(id, nextStatus) {
    const data = await authFetchJson(`/api/admin/pois/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (data.error) return setMessage(data.error)
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, status: nextStatus } : x))
    setMessage('Status gespeichert')
  }

  async function deletePoi(id, title) {
    const ok = window.confirm(`POI wirklich vollständig löschen?\n\n${title}`)
    if (!ok) return
    const data = await authFetchJson(`/api/admin/pois/${id}`, { method: 'DELETE' })
    if (data.error) return setMessage(data.error)
    setItems((prev) => prev.filter((x) => x.id !== id))
    setMessage('POI vollständig gelöscht')
  }

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Alle POIs</h1>
      {message && <div className="notice">{message}</div>}

      <div className="admin-pois-toolbar">
        <div className="card admin-pois-filter-card">
          <div className="admin-table-filters">
            <div>
              <label className="label">Status</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">alle</option>
                <option value="pending">pending</option>
                <option value="published">published</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titelsuche" />
            </div>
            <div>
              <label className="label">Kategorie</label>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">alle</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bundesstaat</label>
              <select className="select" value={stateValue} onChange={(e) => setStateValue(e.target.value)}>
                <option value="">alle</option>
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fehlt</label>
              <select className="select" value={missing} onChange={(e) => setMissing(e.target.value)}>
                <option value="">nichts</option>
                <option value="images">Bilder</option>
                <option value="category">Kategorie</option>
                <option value="description">Beschreibung</option>
                <option value="reviews">Reviews</option>
              </select>
            </div>
            <div>
              <label className="label">Sortierung</label>
              <select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="updated_at">Geändert</option>
                <option value="created_at">Erstellt</option>
                <option value="title">Name</option>
                <option value="status">Status</option>
                <option value="category">Kategorie</option>
                <option value="city">Ort</option>
                <option value="state">Bundesstaat</option>
              </select>
            </div>
            <div>
              <label className="label">POIs pro Seite</label>
              <select className="select" value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))}>
                {[10, 20, 30, 40, 80, 100, 200, 300, 500, 1000].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button className="btn btn-secondary" onClick={applyAndReset}>Anwenden</button>
            <button className="btn btn-secondary" onClick={() => {
              setStatus('all'); setQ(''); setCategoryId(''); setStateValue(''); setUserQuery(''); setSortKey('updated_at'); setMissing(''); setPage(1)
              setTimeout(() => load({ status:'all', q:'', categoryId:'', stateValue:'', userQuery:'', missing:'', page:1, pageSize }), 0)
            }}>Reset</button>
          </div>
        </div>

        <div className="card admin-pois-bulk-card">
          <div className="admin-pois-bulk-actions">
            <label className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                onChange={(e) => toggleVisible(e.target.checked)}
              />
              Alle angezeigten markieren
            </label>
            <span className="badge">Anzahl markierte: {selectedCount}</span>
            <select className="select admin-poi-bulk-select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={!selectedCount || bulkBusy}>
              <option value="pending">pending</option>
              <option value="published">published</option>
              <option value="rejected">rejected</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={bulkChangeStatus} disabled={!selectedCount || bulkBusy}>Status ändern</button>
            <button type="button" className="btn btn-danger" onClick={bulkDeletePois} disabled={!selectedCount || bulkBusy}>Löschen</button>
          </div>
        </div>
      </div>

      <div className="muted" style={{ marginBottom: 8 }}>Treffer: {(sortedItems.length || 0).toLocaleString('de-DE')} von {(meta.total || 0).toLocaleString('de-DE')}</div>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              <th style={{ width: 42 }}></th>
              <th>Name</th>
              <th>Status</th>
              <th>Kategorie</th>
              <th>Ort</th>
              <th>Bundesstaat</th>
              <th>Erstellt</th>
              <th>Geändert</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((poi) => (
              <tr key={poi.id}>
                <td><input type="checkbox" checked={selectedIds.includes(poi.id)} onChange={() => toggleSelected(poi.id)} aria-label={`POI ${poi.title || poi.id} markieren`} /></td>
                <td className="admin-poi-title-cell">{poi.slug ? <Link href={`/poi/${poi.slug}`} className="poi-inline-link admin-poi-title-link" title={poi.title}>{poi.title}</Link> : <span className="admin-poi-title-link" title={poi.title}>{poi.title}</span>}</td>
                <td>
                  <div className="admin-poi-status-control">
                    <StatusBadge value={poi.status} />
                    <select className="select" value={poi.status} onChange={(e) => changeStatus(poi.id, e.target.value)}>
                      <option value="pending">pending</option>
                      <option value="published">published</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>
                </td>
                <td>{poi.categories?.name || '-'}</td>
                <td>{poi.city || '-'}</td>
                <td>{poi.state || '-'}</td>
                <td>{poi.created_at ? String(poi.created_at).slice(0, 10) : '-'}</td>
                <td>{poi.updated_at ? String(poi.updated_at).slice(0, 10) : '-'}</td>
                <td>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Link className="btn btn-secondary admin-mini-btn" href={`/admin/poi/${poi.id}`}>Bearbeiten</Link>
                    <button className="btn btn-danger admin-mini-btn" onClick={() => deletePoi(poi.id, poi.title)}>Löschen</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:16 }}>
        <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</button>
        <div className="badge">Seite {page} / {totalPages}</div>
        <button className="btn btn-secondary" disabled={!meta.has_more} onClick={() => setPage((p) => p + 1)}>Weiter</button>
      </div>
    </main>
  )
}
