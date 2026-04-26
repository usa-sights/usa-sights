'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { authFetchJson } from '@/utils/authFetch'

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Rolle' },
  { key: 'pois', label: 'POIs' },
  { key: 'images', label: 'Bilder' },
  { key: 'links', label: 'Links' },
  { key: 'reviewsWithText', label: 'Bewertungen mit Text' },
  { key: 'reviewsWithoutText', label: 'Bewertungen ohne Text' },
  { key: 'comments', label: 'Kommentare' },
  { key: 'activityTotal', label: 'Gesamtaktivität' },
]

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function AdminUsersClient() {
  const [items, setItems] = useState([])
  const [details, setDetails] = useState([])
  const [message, setMessage] = useState('')
  const [savingRoleId, setSavingRoleId] = useState('')
  const [sortKey, setSortKey] = useState('activityTotal')
  const [sortDir, setSortDir] = useState('desc')
  const [roleFilter, setRoleFilter] = useState('')
  const [period, setPeriod] = useState('0')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState({ userId: '', contentType: '' })

  async function load(nextSelected = selected) {
    try {
      const params = new URLSearchParams({ sort: sortKey, dir: sortDir, role: roleFilter, period, q: query.trim() })
      if (nextSelected.userId && nextSelected.contentType) {
        params.set('user_id', nextSelected.userId)
        params.set('content_type', nextSelected.contentType)
      }
      const data = await authFetchJson('/api/admin/user-ranking?' + params.toString())
      if (data.error) return setMessage(data.error)
      setItems(data.items || [])
      setDetails(data.details || [])
      setMessage('')
    } catch (e) {
      setMessage(e.message)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSortKey(params.get('sort') || 'activityTotal')
    setSortDir(params.get('dir') || 'desc')
    setRoleFilter(params.get('role') || '')
    setPeriod(params.get('period') || '0')
    setQuery(params.get('q') || '')
    setSelected({ userId: params.get('user_id') || '', contentType: params.get('content_type') || '' })
  }, [])

  useEffect(() => {
    load()
  }, [sortKey, sortDir, roleFilter, period, selected])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('sort', sortKey)
    url.searchParams.set('dir', sortDir)
    if (roleFilter) url.searchParams.set('role', roleFilter)
    else url.searchParams.delete('role')
    if (period && period !== '0') url.searchParams.set('period', period)
    else url.searchParams.delete('period')
    if (query.trim()) url.searchParams.set('q', query.trim())
    else url.searchParams.delete('q')
    if (selected.userId && selected.contentType) {
      url.searchParams.set('user_id', selected.userId)
      url.searchParams.set('content_type', selected.contentType)
    } else {
      url.searchParams.delete('user_id')
      url.searchParams.delete('content_type')
    }
    window.history.replaceState({}, '', url.toString())
  }, [sortKey, sortDir, roleFilter, period, query, selected])

  function applySearch() {
    load(selected)
  }

  async function changeRole(id, role) {
    setSavingRoleId(id)
    setMessage('')
    try {
      const data = await authFetchJson('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      if (data.error) throw new Error(data.error)
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, role: data.item?.role || role } : item))
      setMessage(data.message || 'Rolle aktualisiert.')
      window.dispatchEvent(new Event('app-data-changed'))
    } catch (err) {
      setMessage(err.message || 'Rolle konnte nicht aktualisiert werden.')
    } finally {
      setSavingRoleId('')
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'role' ? 'asc' : 'desc')
    }
  }

  function openDetails(userId, contentType) {
    const next = { userId, contentType }
    setSelected(next)
    load(next)
  }

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.pois += item.pois || 0
    acc.images += item.images || 0
    acc.links += item.links || 0
    acc.reviewsWithText += item.reviewsWithText || 0
    acc.reviewsWithoutText += item.reviewsWithoutText || 0
    acc.comments += item.comments || 0
    return acc
  }, { pois:0, images:0, links:0, reviewsWithText:0, reviewsWithoutText:0, comments:0 }), [items])

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Nutzer</h1>
      {message ? <div className="notice">{message}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="admin-table-filters">
          <div>
            <label className="label">Suche</label>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, E-Mail oder User-ID" />
          </div>
          <div>
            <label className="label">Rolle</label>
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">alle</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Zeitraum</label>
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="0">gesamt</option>
              <option value="7">letzte 7 Tage</option>
              <option value="30">letzte 30 Tage</option>
              <option value="90">letzte 90 Tage</option>
            </select>
          </div>
          <div>
            <label className="label">Sortierung</label>
            <select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
              {columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
            </select>
          </div>
          <div className="home-map-search-actions" style={{ alignSelf:'end' }}>
            <button type="button" className="btn btn-secondary" onClick={applySearch}>Aktualisieren</button>
          </div>
        </div>
        <p className="muted" style={{ margin:'8px 0 0' }}>
          Geladene Nutzer: <strong>{items.length.toLocaleString('de-DE')}</strong> · POIs {totals.pois.toLocaleString('de-DE')} · Bilder {totals.images.toLocaleString('de-DE')} · Links {totals.links.toLocaleString('de-DE')}
        </p>
      </div>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              <th>User-ID</th>
              {columns.map((column) => (
                <th key={column.key}><button type="button" className="table-sort-btn" onClick={() => toggleSort(column.key)}>{column.label}{sortKey === column.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
              ))}
              <th>E-Mail</th>
              <th>Registriert</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><code>{item.id}</code></td>
                <td>
                  <div><strong>{item.name || '-'}</strong></div>
                  <div className="muted">{item.email || '-'}</div>
                </td>
                <td>
                  <select className="select" value={item.role || 'user'} onChange={(e) => changeRole(item.id, e.target.value)} disabled={savingRoleId === item.id} style={{ minWidth: 120 }}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'pois')}>{(item.pois || 0).toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'images')}>{(item.images || 0).toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'links')}>{(item.links || 0).toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'reviewsWithText')}>{(item.reviewsWithText || 0).toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'reviewsWithoutText')}>{(item.reviewsWithoutText || 0).toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => openDetails(item.id, 'comments')}>{(item.comments || 0).toLocaleString('de-DE')}</button></td>
                <td><strong>{(item.activityTotal || 0).toLocaleString('de-DE')}</strong></td>
                <td>{item.email || '-'}</td>
                <td>{formatDate(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.userId && selected.contentType ? (
        <div className="card" style={{ marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <h2 style={{ margin:0 }}>Gefilterte Detailansicht</h2>
            <button type="button" className="btn btn-secondary" onClick={() => setSelected({ userId:'', contentType:'' })}>Schließen</button>
          </div>
          <div className="dashboard-content-list" style={{ marginTop:12 }}>
            {details.map((item) => item.href ? (
              <Link key={`${item.id}-${item.href}`} href={item.href} className="dashboard-list-item">
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </div>
                <div className="dashboard-list-meta"><small>{formatDate(item.created_at)}</small></div>
              </Link>
            ) : (
              <div key={item.id} className="dashboard-list-item">
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </div>
                <div className="dashboard-list-meta"><small>{formatDate(item.created_at)}</small></div>
              </div>
            ))}
            {!details.length ? <p className="muted">Keine passenden Einträge gefunden.</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
