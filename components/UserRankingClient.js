'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const columns = [
  { key: 'name', label: 'User' },
  { key: 'pois', label: 'POIs' },
  { key: 'images', label: 'Bilder' },
  { key: 'links', label: 'Links' },
  { key: 'reviews', label: 'Bewertungen' },
  { key: 'comments', label: 'Kommentare' },
  { key: 'total', label: 'Gesamt' },
  { key: 'share', label: 'Anteil' },
]

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}

export default function UserRankingClient() {
  const [sortKey, setSortKey] = useState('total')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ enabled: null, items: [], total: 0, details: [], totals: { users: 0, contributions: 0 } })
  const [selected, setSelected] = useState({ userId: '', contentType: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSortKey(params.get('sort') || 'total')
    setSortDir(params.get('dir') || 'desc')
    setPage(Math.max(1, Number(params.get('page') || 1)))
    setSelected({ userId: params.get('user_id') || '', contentType: params.get('content_type') || '' })
  }, [])

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams({ sort: sortKey, dir: sortDir, page: String(page), page_size: '25', t: String(Date.now()) })
      if (selected.userId && selected.contentType) {
        params.set('user_id', selected.userId)
        params.set('content_type', selected.contentType)
      }
      const res = await fetch(`/api/public/user-ranking?${params.toString()}`, { cache: 'no-store' })
      const next = await res.json()
      if (next.error) return setMessage(next.error)
      setMessage('')
      setData(next)
      const url = new URL(window.location.href)
      url.searchParams.set('sort', sortKey)
      url.searchParams.set('dir', sortDir)
      url.searchParams.set('page', String(page))
      if (selected.userId && selected.contentType) {
        url.searchParams.set('user_id', selected.userId)
        url.searchParams.set('content_type', selected.contentType)
      } else {
        url.searchParams.delete('user_id')
        url.searchParams.delete('content_type')
      }
      window.history.replaceState({}, '', url.toString())
    }
    load()
  }, [sortKey, sortDir, page, selected])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / 25)), [data.total])

  function changeSort(key) {
    if (sortKey === key) setSortDir((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (data.enabled === null) {
    return <main className="container admin-editor-container"><p>Lädt ...</p></main>
  }

  if (data.enabled === false) {
    return (
      <main className="container admin-editor-container">
        <h1>User-Ranking & Beteiligung</h1>
        <div className="card">
          <p className="muted">Das öffentliche Ranking ist aktuell noch nicht freigeschaltet.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container admin-editor-container">
      <h1>User-Ranking & Beteiligung</h1>
      <p className="muted">Hier siehst du freigegebene Beiträge der Community. Ein Klick auf einen Zahlenwert öffnet die passende Detailansicht.</p>
      {message ? <div className="notice">{message}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Nutzer insgesamt: <strong>{Number(data.totals?.users || 0).toLocaleString('de-DE')}</strong> · Beiträge insgesamt: <strong>{Number(data.totals?.contributions || 0).toLocaleString('de-DE')}</strong>
        </p>
      </div>

      <div className="card admin-table-wrap">
        <table className="admin-poi-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}><button type="button" className="table-sort-btn" onClick={() => changeSort(column.key)}>{column.label}{sortKey === column.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => setSelected({ userId: item.id, contentType: 'pois' })}>{item.pois.toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => setSelected({ userId: item.id, contentType: 'images' })}>{item.images.toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => setSelected({ userId: item.id, contentType: 'links' })}>{item.links.toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => setSelected({ userId: item.id, contentType: 'reviews' })}>{item.reviews.toLocaleString('de-DE')}</button></td>
                <td><button type="button" className="kpi-link-btn" onClick={() => setSelected({ userId: item.id, contentType: 'comments' })}>{item.comments.toLocaleString('de-DE')}</button></td>
                <td><strong>{Number(item.total || 0).toLocaleString('de-DE')}</strong></td>
                <td><strong>{Number(item.share || 0).toFixed(1).replace('.', ',')}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:16 }}>
        <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Zurück</button>
        <div className="badge">Seite {page} / {totalPages}</div>
        <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Weiter</button>
      </div>

      {selected.userId && selected.contentType ? (
        <div className="card" style={{ marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <h2 style={{ margin:0 }}>Detailansicht</h2>
            <button type="button" className="btn btn-secondary" onClick={() => setSelected({ userId:'', contentType:'' })}>Schließen</button>
          </div>
          <div className="dashboard-content-list" style={{ marginTop:12 }}>
            {(data.details || []).map((item) => item.href ? (
              <Link key={`${item.id}-${item.href}`} href={item.href} className="dashboard-list-item dashboard-list-item-thumb">
                {item.kind === 'image' && item.thumb_url ? <img className="content-thumb" src={item.thumb_url} alt={item.title} loading="lazy" /> : null}
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                  {item.kind === 'link' && item.url ? <small><a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{item.url}</a></small> : null}
                </div>
                <div className="dashboard-list-meta"><small>{formatDate(item.created_at)}</small></div>
              </Link>
            ) : (
              <div key={item.id} className="dashboard-list-item dashboard-list-item-thumb">
                {item.kind === 'image' && item.thumb_url ? <img className="content-thumb" src={item.thumb_url} alt={item.title} loading="lazy" /> : null}
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                  {item.kind === 'link' && item.url ? <small><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a></small> : null}
                </div>
                <div className="dashboard-list-meta"><small>{formatDate(item.created_at)}</small></div>
              </div>
            ))}
            {!data.details?.length ? <p className="muted">Keine passenden Einträge gefunden.</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
