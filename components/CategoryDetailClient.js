'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ExploreMap from '@/components/ExploreMap'
import Link from 'next/link'
import PublicDiscoverySection from '@/components/PublicDiscoverySection'
import { useAppDataRefresh } from '@/hooks/useAppDataRefresh'

function useDebouncedValue(value, delay = 220) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function CategoryDetailClient({ slug }) {
  const [category, setCategory] = useState(undefined)
  const [pois, setPois] = useState([])
  const [search, setSearch] = useState('')
  const viewportRef = useRef(null)
  const requestKeyRef = useRef('')
  const controllerRef = useRef(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 220)

  useEffect(() => {
    let active = true
    async function loadCategory() {
      const res = await fetch(`/api/categories?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!active) return
      const nextCategory = Array.isArray(data?.items) ? (data.items[0] || null) : (data || null)
      setCategory(nextCategory)
    }
    loadCategory()
    return () => { active = false }
  }, [slug])

  const loadPois = useCallback(async (bounds, forcedSearch = debouncedSearch) => {
    if (!category?.id || !bounds) return

    viewportRef.current = bounds
    const params = new URLSearchParams({
      category_id: String(category.id),
      include_images: '1',
      limit: '500',
      minLat: String(bounds.minLat),
      maxLat: String(bounds.maxLat),
      minLng: String(bounds.minLng),
      maxLng: String(bounds.maxLng),
    })
    if (forcedSearch) params.set('q', forcedSearch)

    const requestKey = params.toString()
    if (requestKey === requestKeyRef.current) return
    requestKeyRef.current = requestKey

    if (controllerRef.current) controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch(`/api/public-pois?${requestKey}&t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({ items: [] }))
      setPois(Array.isArray(data?.items) ? data.items : [])
    } catch (error) {
      if (error?.name !== 'AbortError') console.error(error)
    }
  }, [category?.id, debouncedSearch])

  useEffect(() => {
    if (!category?.id) return
    requestKeyRef.current = ''
    loadPois(viewportRef.current || { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66, zoom: 4 }, debouncedSearch)
  }, [category?.id, debouncedSearch, loadPois])

  useAppDataRefresh(() => {
    requestKeyRef.current = ''
    if (viewportRef.current) loadPois(viewportRef.current, debouncedSearch)
  })

  if (category === undefined) return <main className="container"><p>Lädt ...</p></main>
  if (category === null) return <main className="container"><div className="error-box">Kategorie nicht gefunden.</div></main>

  return (
    <main className="container admin-editor-container">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>{category.name}</h1>
        <p className="muted">{category.description || '-'}</p>
        <label className="label">Instant-Suche</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="POI innerhalb dieser Kategorie filtern" />
        <div className="badge">{pois.length} POIs</div>
      </div>

      <PublicDiscoverySection categoryId={category.id} titlePrefix={`${category.name} ·`} />

      <div className="card category-map-card" style={{ padding: 0, overflow: 'visible', marginTop: 16 }}>
        <div className="home-map category-home-map" style={{ height: '78vh', overflow: 'visible' }}>
          <ExploreMap
            key={`category-map-${category.id}`}
            points={pois}
            onViewportChange={loadPois}
            fullScreen
            showTrailToggle
            mapContext="category"
            height="78vh"
          />
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        {pois.map((poi) => (
          <Link key={poi.id} href={`/poi/${poi.slug}`} className="card">
            <strong>{poi.title}</strong>
            <p className="muted">{[poi.city, poi.state].filter(Boolean).join(', ')}</p>
            <p>{poi.short_description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
