'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import POIForm from '@/components/POIForm'
import UserPOIImageUploader from '@/components/UserPOIImageUploader'
import { authFetchJson } from '@/utils/authFetch'

export default function MyPOIsClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [coords, setCoords] = useState(null)
  const [role, setRole] = useState('user')
  const [userId, setUserId] = useState(null)

  async function load() {
    const d = await authFetchJson('/api/me/pois')
    if (d.error) setMessage(d.error)
    setItems(d.items || [])
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      setUserId(data.session?.user?.id || null)
      const profile = await authFetchJson('/api/me/profile')
      setRole(profile.item?.role || 'user')
      await load()
    }
    init()
  }, [supabase])

  useEffect(() => {
    if (selected?.latitude && selected?.longitude) setCoords({ lat: Number(selected.latitude), lng: Number(selected.longitude) })
    else setCoords(null)
  }, [selected])

  const isAdmin = role === 'admin'

  return (
    <main className="container">
      <h1>Meine POIs</h1>
      {message && <div className="notice">{message}</div>}
      <div className="sidebar-layout">
        <div>
          {items.map((poi) => (
            <div key={poi.id} className="card" style={{ marginBottom: 12 }}>
              <strong>{poi.title}</strong>
              <p>{poi.status}</p>
              {(poi.status === 'pending' || isAdmin) ? (
                <button className="btn btn-secondary" onClick={() => setSelected({ ...poi })}>Bearbeiten</button>
              ) : (
                <>
                  <p className="muted">Veröffentlichten Beitrag bitte über Bilder oder Änderungsvorschläge ergänzen.</p>
                  <button className="btn btn-secondary" onClick={() => setSelected({ ...poi })}>Bilder ergänzen</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div>
          {selected ? (
            <>
              {(selected.status === 'pending' || isAdmin) ? (
                <POIForm coords={coords} userId={selected.created_by} initialData={selected} mode="edit" onSaved={load} compactUserMode={!isAdmin} enableAI={isAdmin} />
              ) : null}
              <UserPOIImageUploader poiId={selected.id} userId={userId} />
            </>
          ) : <div className="card">Bitte links einen POI auswählen.</div>}
        </div>
      </div>
    </main>
  )
}
