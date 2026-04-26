'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetchJson } from '@/utils/authFetch'

export default function AdminPendingOverviewClient() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    authFetchJson('/api/admin/pending-overview')
      .then((d) => d.error ? setMessage(d.error) : setData(d))
      .catch((e) => setMessage(e.message))
  }, [])

  if (message) return <main className="container"><div className="error-box">{message}</div></main>
  if (!data) return <main className="container"><p>Lädt ...</p></main>

  const total = (data.pois?.length || 0) + (data.images?.length || 0) + (data.links?.length || 0) + (data.changes?.length || 0) + (data.ai?.length || 0)

  return (
    <main className="container admin-editor-container">
      <h1>Admin / Freigaben</h1>
      <div className="grid grid-4">
        <div className="card dashboard-warn"><div className="dashboard-stat-head"><span>📝</span><span>POIs pending</span></div><div className="dashboard-stat-value">{data.pois?.length || 0}</div></div>
        <div className="card dashboard-warn"><div className="dashboard-stat-head"><span>🖼️</span><span>Bilder pending</span></div><div className="dashboard-stat-value">{data.images?.length || 0}</div></div>
        <div className="card dashboard-warn"><div className="dashboard-stat-head"><span>🔗</span><span>Links pending</span></div><div className="dashboard-stat-value">{data.links?.length || 0}</div></div>
        <div className="card dashboard-warn"><div className="dashboard-stat-head"><span>⚙️</span><span>Offen gesamt</span></div><div className="dashboard-stat-value">{total}</div></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>POIs mit Status pending</h2>
          <div className="dashboard-links">
            {(data.pois || []).length ? data.pois.map((item) => (
              <Link key={item.id} href={`/admin/poi/${item.id}`}>{item.title} · {item.categories?.name || 'Ohne Kategorie'} · {item.created_at}</Link>
            )) : <p className="muted">Keine pending-POIs gefunden.</p>}
          </div>
        </div>
        <div className="card">
          <h2>Weitere offene Moderation</h2>
          <div className="dashboard-links">
            {(data.images || []).map((item) => <Link key={`img-${item.id}`} href="/admin/media">Bild · {item.created_at}</Link>)}
            {(data.links || []).map((item) => <Link key={`link-${item.id}`} href={`/admin/poi/${item.poi_id}`}>Link · {item.label || item.url}</Link>)}
            {(data.changes || []).map((item) => <Link key={`chg-${item.id}`} href={`/admin/poi/${item.poi_id}`}>Änderung · {item.field_name}</Link>)}
            {(data.ai || []).map((item) => <Link key={`ai-${item.id}`} href={`/admin/poi/${item.poi_id}`}>KI · {item.type}</Link>)}
            {!data.images?.length && !data.links?.length && !data.changes?.length && !data.ai?.length ? <p className="muted">Keine weiteren offenen Moderationsfälle.</p> : null}
          </div>
        </div>
      </div>
    </main>
  )
}
