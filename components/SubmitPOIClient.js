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
      <div className="grid grid-2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="large-submit-map">
            <ExploreMap onPick={setCoords} pickedCoords={coords} />
          </div>
        </div>
        <POIForm coords={coords} userId={user?.id ?? null} compactUserMode={!isAdmin} enableAI={isAdmin} />
      </div>
    </main>
  )
}
