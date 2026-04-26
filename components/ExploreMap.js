'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { detectNavigationPlatform } from '@/lib/map/poiUtils'
import { usePoiMarkers } from '@/hooks/usePoiMarkers'

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', minHeight: 420 }} />,
})

export default function ExploreMap({
  points = [],
  pois = [],
  onPick = null,
  pickedCoords = null,
  height = '100%',
  onViewportChange = null,
  fullScreen = false,
  showTrailToggle = false,
  mapContext = 'default',
}) {
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(4)
  const [visibleBounds, setVisibleBounds] = useState(null)
  const [navigationButtonsEnabled, setNavigationButtonsEnabled] = useState(true)
  const [navigationPlatform, setNavigationPlatform] = useState('none')
  const { normalizedPois, markerEntries } = usePoiMarkers({ points, pois, zoom, visibleBounds })

  useEffect(() => {
    setReady(true)
    setNavigationButtonsEnabled(window.localStorage.getItem('mapNavigationButtons') !== '0')
    setNavigationPlatform(detectNavigationPlatform())
    const handler = (event) => setNavigationButtonsEnabled(event?.detail?.enabled !== false)
    window.addEventListener('map-navigation-setting-changed', handler)
    return () => window.removeEventListener('map-navigation-setting-changed', handler)
  }, [])

  if (!ready) return <div style={{ height, minHeight: 420 }} />

  return (
    <MapView
      markerEntries={markerEntries}
      normalizedPois={normalizedPois}
      onPick={onPick}
      pickedCoords={pickedCoords}
      height={height}
      onViewportChange={onViewportChange}
      onZoomChange={setZoom}
      onVisibleBoundsChange={setVisibleBounds}
      fullScreen={fullScreen}
      showTrailToggle={showTrailToggle}
      mapContext={mapContext}
      navigationButtonsEnabled={navigationButtonsEnabled}
      navigationPlatform={navigationPlatform}
    />
  )
}
