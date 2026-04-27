'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, Image as ImageIcon, MapPinned } from 'lucide-react'
import { getPoiHref, getPreviewImageUrl, sortPoisByTitle } from '@/lib/map/poiUtils'

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

const FullscreenPoiSidebar = memo(function FullscreenPoiSidebar({ markerEntries = [], activePoiId = '', onSelectPoi }) {
  const pois = useMemo(() => flattenEntries(markerEntries), [markerEntries])
  const active = useMemo(() => pois.find((poi) => String(poi.id || poi.slug) === String(activePoiId)) || pois[0] || null, [pois, activePoiId])

  if (!pois.length) return null

  return (
    <aside className="map-fullscreen-sidebar" aria-label="POIs im sichtbaren Kartenausschnitt">
      <div className="map-fullscreen-sidebar-head">
        <strong>POIs im Ausschnitt</strong>
        <span>{pois.length.toLocaleString('de-DE')}</span>
      </div>
      <div className="map-fullscreen-poi-list">
        {pois.map((poi) => {
          const image = getPreviewImageUrl(poi)
          const key = String(poi.id || poi.slug)
          const activeClass = active && key === String(active.id || active.slug) ? ' is-active' : ''
          return (
            <button key={key} type="button" className={`map-fullscreen-poi-item${activeClass}`} onClick={() => onSelectPoi?.(key)}>
              <span className="map-fullscreen-poi-thumb">{image ? <img src={image} alt="" loading="lazy" /> : <ImageIcon size={18} />}</span>
              <span className="map-fullscreen-poi-copy"><strong>{poi.title || 'POI'}</strong><small>{[poi.city, poi.state].filter(Boolean).join(', ') || poi.category || 'POI'}</small></span>
            </button>
          )
        })}
      </div>
      {active ? (
        <div className="map-fullscreen-preview">
          {getPreviewImageUrl(active) ? <img src={getPreviewImageUrl(active)} alt={active.title || 'POI'} loading="lazy" /> : null}
          <div className="map-fullscreen-preview-body">
            <strong>{active.title || 'POI'}</strong>
            {active.short_description ? <p>{active.short_description}</p> : null}
            <Link href={getPoiHref(active)} className="map-fullscreen-preview-link"><MapPinned size={16} />Details öffnen<ArrowRight size={15} /></Link>
          </div>
        </div>
      ) : null}
    </aside>
  )
})

export default FullscreenPoiSidebar
