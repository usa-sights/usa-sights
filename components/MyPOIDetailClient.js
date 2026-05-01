"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import POIForm from '@/components/POIForm'
import UserPOIImageUploader from '@/components/UserPOIImageUploader'
import { authFetchJson } from '@/utils/authFetch'

export default function MyPOIDetailClient({ poiId }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [item, setItem] = useState(null)
  const [message, setMessage] = useState('')
  const [role, setRole] = useState('user')
  const [userId, setUserId] = useState(null)
  const [coords, setCoords] = useState(null)
  async function load() {
    const d = await authFetchJson('/api/me/pois')
    if (d.error) return setMessage(d.error)
    const found = (d.items || []).find((x) => String(x.id) === String(poiId))
    if (!found) return setMessage('POI nicht gefunden oder kein Zugriff.')
    setItem(found)
    setCoords(found.latitude && found.longitude ? { lat:Number(found.latitude), lng:Number(found.longitude) } : null)
  }
  useEffect(() => { ;(async () => { const { data } = await supabase.auth.getSession(); setUserId(data.session?.user?.id || null); const profile = await authFetchJson('/api/me/profile'); setRole(profile.item?.role || 'user'); await load() })() }, [poiId, supabase])
  const isAdmin = role === 'admin'
  const canEdit = item && (item.status === 'pending' || isAdmin)
  return <main className="container admin-editor-container"><div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'center' }}><div><h1>Mein POI</h1>{item ? <p className="muted">{item.title} · <span className={`status-pill status-${item.status}`}>{item.status}</span></p> : null}</div><Link className="btn btn-secondary" href="/account/my-pois">Zurück zur Liste</Link></div>{message ? <div className="notice">{message}</div> : null}{!item ? <div className="card">POI wird geladen ...</div> : <div className="grid grid-2" style={{ alignItems:'start' }}><div>{canEdit ? <POIForm coords={coords} userId={item.created_by} initialData={item} mode="edit" onSaved={load} compactUserMode={!isAdmin} enableAI={isAdmin} /> : <div className="card"><h2>Bearbeitung abgeschlossen</h2><p className="muted">Dieser POI ist bereits veröffentlicht. Inhalte können nicht mehr direkt bearbeitet werden. Du kannst aber weitere Bilder beitragen.</p>{item.slug ? <Link className="btn btn-secondary" href={`/poi/${item.slug}`}>POI ansehen</Link> : null}</div>}</div><div><UserPOIImageUploader poiId={item.id} userId={userId} title={item.status === 'published' ? 'Fotos zu deinem veröffentlichten POI hochladen' : 'Fotos zu deinem POI hochladen'} /></div></div>}</main>
}
