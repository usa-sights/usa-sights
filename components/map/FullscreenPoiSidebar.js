'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Heart, Image as ImageIcon, MapPinned, MessageCircle, Star } from 'lucide-react'
import { authFetchJson } from '@/utils/authFetch'
import SmartImage from '@/components/map/SmartImage'
import { getPoiHref, getPoiReviewHref, sortPoisByTitle } from '@/lib/map/poiUtils'

function flattenEntries(entries = []) {
  const map = new Map()
  for (const entry of entries) {
    const items = entry?.type === 'cluster' ? entry.items : [entry?.item]
    for (const item of items || []) {
      if (!item) continue
      const key = item.id || item.slug || `${item.title}-${item.latitude}-${item.longitude}`
      if (!map.has(key)) map.set(key, item)
    }
  }
  return sortPoisByTitle(Array.from(map.values())).slice(0, 120)
}

function PoiMeta({ poi, compact = false }) {
  const ratingAverage = Number(poi?.rating_average || 0)
  const ratingCount = Number(poi?.rating_count || 0)
  const commentCount = Number(poi?.comment_count || 0)
  if (!ratingCount && !commentCount) return null

  return (
    <span className={`map-sidebar-meta${compact ? ' is-compact' : ''}`}>
      {ratingCount ? <span><Star size={13} />{ratingAverage ? ratingAverage.toFixed(1) : '0.0'} ({ratingCount.toLocaleString('de-DE')})</span> : null}
      {commentCount ? <Link href={getPoiReviewHref(poi)} onClick={(event) => event.stopPropagation()}><MessageCircle size={13} />{commentCount.toLocaleString('de-DE')}</Link> : null}
    </span>
  )
}

const FullscreenPoiSidebar = memo(function FullscreenPoiSidebar({ markerEntries = [], activePoiId = '', onSelectPoi }) {
  const pois = useMemo(() => flattenEntries(markerEntries), [markerEntries])
  const active = useMemo(() => pois.find((poi) => String(poi.id || poi.slug) === String(activePoiId)) || pois[0] || null, [pois, activePoiId])
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())
  const [favoriteReady, setFavoriteReady] = useState(false)
  const [favoriteMessage, setFavoriteMessage] = useState('')

  useEffect(() => {
    let activeRequest = true
    authFetchJson('/api/me/favorites')
      .then((data) => {
        if (!activeRequest) return
        if (data?.error) {
          setFavoriteReady(false)
          return
        }
        const ids = new Set((data.items || []).map((item) => String(item.poi_id || item.pois?.id)).filter(Boolean))
        setFavoriteIds(ids)
        setFavoriteReady(true)
      })
      .catch(() => setFavoriteReady(false))
    return () => { activeRequest = false }
  }, [])

  const toggleFavorite = useCallback(async (poi) => {
    const id = String(poi?.id || '')
    if (!id) return
    setFavoriteMessage('')
    const isFavorite = favoriteIds.has(id)
    const result = await authFetchJson('/api/me/favorites', {
      method: isFavorite ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poi_id: id }),
    })
    if (result?.error) {
      setFavoriteMessage(result.error.includes('Unauthorized') || result.error.includes('Nicht angemeldet') ? 'Bitte einloggen, um Favoriten zu speichern.' : result.error)
      return
    }
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (isFavorite) next.delete(id)
      else next.add(id)
      return next
    })
    setFavoriteReady(true)
  }, [favoriteIds])

  if (!pois.length) return null

  return (
    <aside className="map-fullscreen-sidebar" aria-label="POIs im sichtbaren Kartenausschnitt">
      <div className="map-fullscreen-sidebar-head">
        <strong>POIs im Ausschnitt</strong>
        <span>{pois.length.toLocaleString('de-DE')}</span>
      </div>
      {favoriteMessage ? <div className="map-sidebar-message">{favoriteMessage}</div> : null}
      <div className="map-fullscreen-poi-list">
        {pois.map((poi) => {
          const key = String(poi.id || poi.slug)
          const activeClass = active && key === String(active.id || active.slug) ? ' is-active' : ''
          const isFavorite = favoriteIds.has(String(poi.id))
          return (
            <div key={key} className={`map-fullscreen-poi-item${activeClass}`}>
              <button type="button" className="map-fullscreen-poi-main" onClick={() => onSelectPoi?.(key)}>
                <span className="map-fullscreen-poi-thumb"><SmartImage item={poi} alt="" width={180} height={130} fallback={<ImageIcon size={18} />} /></span>
                <span className="map-fullscreen-poi-copy">
                  <strong>{poi.title || 'POI'}</strong>
                  <small>{[poi.city, poi.state].filter(Boolean).join(', ') || poi.category || 'POI'}</small>
                  <PoiMeta poi={poi} compact />
                </span>
              </button>
              <button
                type="button"
                className={`map-sidebar-favorite-btn${isFavorite ? ' is-active' : ''}`}
                onClick={() => toggleFavorite(poi)}
                title={isFavorite ? 'Aus Favoriten entfernen' : 'Als Favorit merken'}
                aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Als Favorit merken'}
              >
                <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          )
        })}
      </div>
      {active ? (
        <div className="map-fullscreen-preview">
          <SmartImage item={active} alt={active.title || 'POI'} width={420} height={240} />
          <div className="map-fullscreen-preview-body">
            <strong>{active.title || 'POI'}</strong>
            <PoiMeta poi={active} />
            {active.short_description ? <p>{active.short_description}</p> : null}
            <div className="map-fullscreen-preview-actions">
              <Link href={getPoiHref(active)} className="map-fullscreen-preview-link"><MapPinned size={16} />Details öffnen<ArrowRight size={15} /></Link>
              <button type="button" className={`map-sidebar-preview-favorite${favoriteIds.has(String(active.id)) ? ' is-active' : ''}`} onClick={() => toggleFavorite(active)}>
                <Heart size={16} fill={favoriteIds.has(String(active.id)) ? 'currentColor' : 'none'} />
                {favoriteIds.has(String(active.id)) ? 'Gemerkter Favorit' : 'Favorit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
})

export default FullscreenPoiSidebar
