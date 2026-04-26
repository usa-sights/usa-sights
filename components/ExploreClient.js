'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import ExploreMap from '@/components/ExploreMap'

export default function ExploreClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [pois, setPois] = useState([])
  const [categories, setCategories] = useState([])
  const [states, setStates] = useState([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [state, setState] = useState('')
  const viewportRef = useRef(null)
  const requestKeyRef = useRef('')
  const abortRef = useRef(null)

  useEffect(() => {
    async function init() {
      const { data: cats } = await supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order')
      setCategories(cats || [])
    }
    init()
  }, [supabase])

  const loadPois = useCallback(async (nextViewport = viewportRef.current) => {
    if (!nextViewport) return
    viewportRef.current = nextViewport
    const qs = new URLSearchParams({
      minLat: String(nextViewport.minLat),
      maxLat: String(nextViewport.maxLat),
      minLng: String(nextViewport.minLng),
      maxLng: String(nextViewport.maxLng),
      limit: '1500',
    })
    if (search) qs.set('q', search)
    if (categoryId) qs.set('category_id', categoryId)
    if (state) qs.set('state', state)

    const key = qs.toString()
    if (key === requestKeyRef.current) return
    requestKeyRef.current = key

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/public-pois?${key}`, { cache: 'no-store', signal: controller.signal })
      const data = await res.json()
      setPois(data.items || [])
      setStates((prev) => prev.length ? prev : Array.from(new Set((data.items || []).map((x) => x.state).filter(Boolean))).sort())
    } catch (err) {
      if (err?.name !== 'AbortError') console.error(err)
    }
  }, [search, categoryId, state])

  useEffect(() => {
    if (viewportRef.current) loadPois(viewportRef.current)
  }, [search, categoryId, state, loadPois])

  return (
    <main className="explore-shell">
      <div className="explore-filters">
        <div className="explore-filters-inner explore-filters-inline">
          <div>
            <label className="label">Suche</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="z. B. Grand Canyon" />
          </div>
          <div>
            <label className="label">Kategorie</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bundesstaat</label>
            <input className="input" value={state} onChange={(e) => setState(e.target.value)} placeholder="z. B. Arizona" list="explore-states" />
            <datalist id="explore-states">
              {states.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
      </div>
      <ExploreMap points={pois} onViewportChange={loadPois} fullScreen showTrailToggle mapContext="explore" />
    </main>
  )
}
