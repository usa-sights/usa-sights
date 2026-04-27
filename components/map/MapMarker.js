'use client'

import { memo, useMemo, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import ClusterPopup from '@/components/map/ClusterPopup'
import PoiPopup from '@/components/map/PoiPopup'
import { clusterIcon, iconForCategory } from '@/components/map/mapIcons'

function itemKey(item) {
  return String(item?.id || item?.slug || '')
}

const MapMarker = memo(function MapMarker({ entry, navigationButtonsEnabled, navigationPlatform, activePoiId = '', onActivatePoi }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const active = useMemo(() => {
    if (!activePoiId) return false
    if (entry.type === 'cluster') return (entry.items || []).some((item) => itemKey(item) === String(activePoiId))
    return itemKey(entry.item) === String(activePoiId)
  }, [activePoiId, entry])

  const popupHandlers = useMemo(() => ({
    popupopen: () => {
      setIsPopupOpen(true)
      if (entry.type === 'single') onActivatePoi?.(itemKey(entry.item))
    },
    popupclose: () => setIsPopupOpen(false),
    click: () => {
      if (entry.type === 'single') onActivatePoi?.(itemKey(entry.item))
    },
  }), [entry, onActivatePoi])

  const icon = useMemo(() => {
    if (entry.type === 'cluster') return clusterIcon(entry.items.length, { active })
    return iconForCategory(entry.item?.categories?.name, { active })
  }, [entry, active])

  if (entry.type === 'cluster') {
    return (
      <Marker position={[entry.lat, entry.lng]} icon={icon} keyboard title={`${entry.items.length} POIs anzeigen`} eventHandlers={popupHandlers}>
        <Popup maxWidth={360} autoPan>
          {isPopupOpen ? <ClusterPopup items={entry.items} /> : null}
        </Popup>
      </Marker>
    )
  }

  const item = entry.item
  return (
    <Marker position={[Number(item.latitude), Number(item.longitude)]} icon={icon} keyboard title={item.title || 'POI anzeigen'} eventHandlers={popupHandlers}>
      <Popup maxWidth={360} autoPan>
        {isPopupOpen ? <PoiPopup item={item} navigationButtonsEnabled={navigationButtonsEnabled} navigationPlatform={navigationPlatform} /> : null}
      </Popup>
    </Marker>
  )
})

export default MapMarker
