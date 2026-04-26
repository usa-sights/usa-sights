'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { getPoiHref, sortPoisByTitle } from '@/lib/map/poiUtils'

const ClusterPopup = memo(function ClusterPopup({ items }) {
  const sortedItems = useMemo(() => sortPoisByTitle(items), [items])

  return (
    <div className="map-cluster-popup">
      <div className="map-cluster-popup-head">
        <ListChecks size={17} />
        <strong>{items.length} POIs an dieser Stelle</strong>
      </div>
      <p className="muted map-cluster-popup-hint">Wähle einen Eintrag, um direkt zur Detailseite zu wechseln.</p>
      <div className="map-cluster-list">
        {sortedItems.map((item) => (
          <Link key={item.id || `${item.slug}-${item.title}`} href={getPoiHref(item)} className="map-cluster-link">
            <span className="map-cluster-link-title">{item.title || 'POI öffnen'}</span>
            {[item.city, item.state].filter(Boolean).length ? (
              <span className="map-cluster-link-meta">{[item.city, item.state].filter(Boolean).join(', ')}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  )
})

export default ClusterPopup
