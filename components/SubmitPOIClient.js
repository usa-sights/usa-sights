'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import ExploreMap from '@/components/ExploreMap'
import POIForm from '@/components/POIForm'
import { authFetchJson } from '@/utils/authFetch'

export default function SubmitPOIClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [coords, setCoords] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [pickedPlace, setPickedPlace] = useState(null)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      const currentUser = data.session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const profile = await authFetchJson('/api/me/profile')
        setRole(profile.item?.role || 'user')
      }
      setLoading(false)
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const profile = await authFetchJson('/api/me/profile')
        setRole(profile.item?.role || 'user')
      } else {
        setRole('user')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 3) {
      setSearchResults([])
      setSearchMessage('')
      return
    }
    if (pickedPlace?.title && query === pickedPlace.title) {
      setSearchResults([])
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchMessage('')
      try {
        const res = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Suche fehlgeschlagen')
        setSearchResults(data.items || [])
        setSearchMessage((data.items || []).length ? '' : 'Keine passenden Orte gefunden.')
      } catch (err) {
        if (err.name !== 'AbortError') setSearchMessage(err.message || 'Suche fehlgeschlagen')
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, pickedPlace?.title])

  function selectPlace(place) {
    if (!place?.lat || !place?.lng) return
    const nextCoords = { lat: Number(place.lat), lng: Number(place.lng) }
    setCoords(nextCoords)
    setPickedPlace({ title: place.title || place.name || searchQuery.trim(), lat: nextCoords.lat, lng: nextCoords.lng })
    setSearchQuery(place.title || place.name || searchQuery.trim())
    setSearchResults([])
    setSearchMessage('Standort übernommen. Titel wurde im Formular vorausgefüllt.')
  }

  if (loading) return <main className="container"><div className="card">Lädt ...</div></main>

  if (!user) {
    return (
      <main className="container">
        <h1>POI vorschlagen</h1>
        <div className="card">
          <h2>Bitte zuerst einloggen</h2>
          <p>Nur eingeloggte Nutzer können einen POI-Vorschlag absenden.</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
            <Link className="btn" href="/login">Login</Link>
            <Link className="btn btn-secondary" href="/register">Registrieren</Link>
          </div>
          <p className="muted" style={{ marginTop:12 }}>Sicher einloggen – deine Daten bleiben geschützt.</p>
        </div>
      </main>
    )
  }

  const isAdmin = role === 'admin'

  return (
    <main className="container">
      <h1>POI vorschlagen</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label">Ort suchen und übernehmen</label>
        <input
          className="input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="z. B. Zion National Park, Grand Canyon, Yosemite ..."
          autoComplete="off"
        />
        <p className="muted" style={{ marginTop: 8 }}>
          Tippe mindestens 3 Zeichen. Beim Auswählen werden Kartenposition und Titel automatisch übernommen. Manuelles Setzen auf der Karte bleibt weiterhin möglich.
        </p>
        {searchLoading ? <p className="muted">Suche läuft ...</p> : null}
        {searchResults.length ? (
          <div className="poi-search-results" role="listbox" aria-label="Ortsvorschläge">
            {searchResults.map((place) => (
              <button key={place.id} type="button" className="poi-search-result" onClick={() => selectPlace(place)}>
                <strong>{place.title}</strong>
                <span>{place.subtitle}</span>
              </button>
            ))}
          </div>
        ) : null}
        {searchMessage ? <p className="muted" style={{ marginTop: 8 }}>{searchMessage}</p> : null}
      </div>
      <div className="grid grid-2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="large-submit-map">
            <ExploreMap onPick={setCoords} pickedCoords={coords} />
          </div>
        </div>
        <POIForm coords={coords} userId={user?.id ?? null} compactUserMode={!isAdmin} enableAI={isAdmin} pickedPlace={pickedPlace} />
      </div>
    </main>
  )
}
