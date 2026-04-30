"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpDown, Filter } from 'lucide-react'
import { authFetch } from '@/utils/authFetch'

const PAGE_SIZE = 25

const sorters = {
  newest: (a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  oldest: (a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
  title: (a,b) => String(a.title || '').localeCompare(String(b.title || '')),
  status: (a,b) => String(a.status || '').localeCompare(String(b.status || '')),
  city: (a,b) => String(a.city || '').localeCompare(String(b.city || '')),
}

function formatDate(value) { return value ? new Intl.DateTimeFormat('de-DE', { dateStyle:'medium' }).format(new Date(value)) : '-' }

export default function MyPOIsTableClient() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sortKey, setSortKey] = useState('newest')
  const [page, setPage] = useState(1)

  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      const r = await authFetch(`/api/me/pois?${params.toString()}`)
      const d = await r.json()
      if (d.error) return setMessage(d.error)
      setItems(d.items || [])
      setTotal(d.total || 0)
    })()
  }, [page])

  const visibleItems = useMemo(() => [...items]
    .filter((poi) => status === 'all' ? true : poi.status === status)
    .filter((poi) => !query.trim() ? true : [poi.title, poi.city, poi.state, poi.address].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort(sorters[sortKey] || sorters.newest), [items, query, status, sortKey])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return <main className="container admin-editor-container"><h1>Meine POIs</h1>{message ? <div className="notice">{message}</div> : null}<div className="card" style={{ marginBottom:12 }}><div className="admin-table-filters my-pois-filters"><div className="my-pois-search-field"><label className="label">Suche</label><div className="input-with-icon"><Search size={16} /><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel, Ort, Adresse" /></div></div><div className="my-pois-status-field"><label className="label">Status</label><div className="input-with-icon"><Filter size={16} /><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">alle</option><option value="pending">pending</option><option value="published">published</option><option value="rejected">rejected</option></select></div></div><div><label className="label">Sortierung</label><div className="input-with-icon"><ArrowUpDown size={16} /><select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="title">Titel A-Z</option><option value="status">Status</option><option value="city">Ort</option></select></div></div></div></div><div className="muted" style={{ marginBottom:8 }}>Treffer: {visibleItems.length.toLocaleString('de-DE')} von {total.toLocaleString('de-DE')}</div><div className="card admin-table-wrap"><table className="admin-poi-table"><thead><tr><th>Name</th><th>Status</th><th>Ort</th><th>Erstellt</th><th>Aktion</th></tr></thead><tbody>{visibleItems.map((poi) => <tr key={poi.id}><td>{poi.slug ? <Link href={`/poi/${poi.slug}`} className="poi-inline-link">{poi.title}</Link> : poi.title}</td><td><span className={`status-pill status-${poi.status}`}>{poi.status}</span></td><td>{[poi.city, poi.state].filter(Boolean).join(', ') || '-'}</td><td>{formatDate(poi.created_at)}</td><td><Link className="btn btn-secondary admin-mini-btn" href={`/account/my-pois/${poi.id}`}>{poi.status === 'published' ? 'Fotos hochladen' : 'Bearbeiten'}</Link></td></tr>)}{!visibleItems.length ? <tr><td colSpan={5}><div className="muted">Keine POIs gefunden.</div></td></tr> : null}</tbody></table></div>{totalPages > 1 ? <div className="admin-pagination" style={{ marginTop: 16 }}><button type="button" className="btn btn-secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Zurück</button><span className="muted">Seite {page.toLocaleString('de-DE')} von {totalPages.toLocaleString('de-DE')}</span><button type="button" className="btn btn-secondary" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Weiter</button></div> : null}</main>
}
