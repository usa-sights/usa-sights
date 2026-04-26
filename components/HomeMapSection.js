'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExploreMap from '@/components/ExploreMap'
import { useAppDataRefresh } from '@/hooks/useAppDataRefresh'

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function HomeMapSection() {
  const [pois, setPois] = useState([])
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [states, setStates] = useState([])
  const lastRequestKey = useRef('')
  const pendingController = useRef(null)
  const viewportRef = useRef(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 220)
  const debouncedState = useDebouncedValue(state.trim(), 220)

  const handleViewportChange = useCallback(async (bounds, forcedSearch = debouncedSearch, forcedState = debouncedState) => {
    if (!bounds) return
    viewportRef.current = bounds
    const params = new URLSearchParams({
      minLat: String(bounds.minLat),
      maxLat: String(bounds.maxLat),
      minLng: String(bounds.minLng),
      maxLng: String(bounds.maxLng),
      limit: '300',
      include_images: '1',
    })
    if (forcedSearch) params.set('q', forcedSearch)
    if (forcedState) params.set('state', forcedState)
    const key = params.toString()
    if (key === lastRequestKey.current) return
    lastRequestKey.current = key

    if (pendingController.current) pendingController.current.abort()
    const controller = new AbortController()
    pendingController.current = controller

    try {
      const res = await fetch(`/api/public-pois?${key}&t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' })
      const data = await res.json()
      const items = data.items || []
      setPois(items)
      const stateList = Array.from(new Set([...(states || []), ...items.map((x) => x.state).filter(Boolean)])).sort()
      if (stateList.length) setStates(stateList)
    } catch (err) {
      if (err?.name !== 'AbortError') console.error(err)
    }
  }, [debouncedSearch, debouncedState, states])

  useEffect(() => {
    if (viewportRef.current) handleViewportChange(viewportRef.current, debouncedSearch, debouncedState)
  }, [debouncedSearch, debouncedState, handleViewportChange])

  useEffect(() => {
    if (viewportRef.current) return
    handleViewportChange({ minLat: 24, maxLat: 50, minLng: -125, maxLng: -66, zoom: 4 }, debouncedSearch, debouncedState)
  }, [handleViewportChange, debouncedSearch, debouncedState])

  const resetFilters = useCallback(() => {
    setSearch('')
    setState('')
    lastRequestKey.current = ''
    if (viewportRef.current) handleViewportChange(viewportRef.current, '', '')
  }, [handleViewportChange])

  useAppDataRefresh(() => {
    lastRequestKey.current = ''
    if (viewportRef.current) handleViewportChange(viewportRef.current, debouncedSearch, debouncedState)
  })

  const resultLabel = useMemo(() => `${pois.length.toLocaleString('de-DE')} Treffer im aktuellen Kartenausschnitt`, [pois.length])

  return (
    <section style={{ width: '100%' }}>
      <div className="container" style={{ paddingBottom: 12 }}>
        <div className="card home-map-search-card">
          <div className="home-map-search">
            <div>
              <label className="label">Suche</label>
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="z. B. Yosemite, Canyon, Museum" />
            </div>
            <div>
              <label className="label">Bundesstaat</label>
              <input className="input" value={state} onChange={(e) => setState(e.target.value)} placeholder="z. B. California" list="home-map-states" />
              <datalist id="home-map-states">
                {states.map((entry) => <option key={entry} value={entry} />)}
              </datalist>
            </div>
            <div className="home-map-search-actions">
              <button type="button" className="btn btn-secondary" onClick={resetFilters}>Filter zurücksetzen</button>
            </div>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Die Karte filtert sofort während der Eingabe. {resultLabel}
          </p>
        </div>
      </div>
      <div className="home-map" style={{ height: '78vh' }}>
        <ExploreMap
          points={pois}
          onViewportChange={handleViewportChange}
          fullScreen
          showTrailToggle
          mapContext="home"
        />
      </div>
    </section>
  )
}
