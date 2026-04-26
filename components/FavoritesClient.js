'use client'

import { useEffect, useMemo, useState } from 'react'
import { authFetchJson } from '@/utils/authFetch'
import ExploreMap from '@/components/ExploreMap'

export default function FavoritesClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    authFetchJson('/api/me/favorites')
      .then((data) => data.error ? setMessage(data.error) : setItems(data.items || []))
      .catch((e) => setMessage(e.message))
  }, [])

  const points = useMemo(() => items.map((item) => ({ ...item.pois, favorite_id: item.id, id: item.pois?.id || item.poi_id || item.id })), [items])

  return (
    <main className="favorites-shell">
      <div className="favorites-head">
        <div className="container">
          <h1>Favoriten</h1>
          {message && <div className="notice">{message}</div>}
        </div>
      </div>
      {points.length ? (
        <div className="favorites-map-wrap">
          <ExploreMap points={points} />
        </div>
      ) : (
        <div className="container"><div className="card">Keine Favoriten vorhanden.</div></div>
      )}
    </main>
  )
}
