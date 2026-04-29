'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import MapControls, { TILE_PRESETS } from '@/components/map/MapControls'
import MapMarker from '@/components/map/MapMarker'
import FullscreenPoiSidebar from '@/components/map/FullscreenPoiSidebar'
import { iconForCategory } from '@/components/map/mapIcons'

function PickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) } })
  return null
}

function ViewportTracker({ onViewportChange, onZoomChange, onVisibleBoundsChange }) {
  const map = useMap()
  const callbackRef = useRef(onViewportChange)
  const zoomRef = useRef(onZoomChange)
  const visibleBoundsRef = useRef(onVisibleBoundsChange)
  const lastKeyRef = useRef('')
  const timerRef = useRef(null)

  useEffect(() => { callbackRef.current = onViewportChange }, [onViewportChange])
  useEffect(() => { zoomRef.current = onZoomChange }, [onZoomChange])
  useEffect(() => { visibleBoundsRef.current = onVisibleBoundsChange }, [onVisibleBoundsChange])

  useEffect(() => {
    function emit() {
      const bounds = map.getBounds()
      const payload = {
        zoom: map.getZoom(),
        minLat: Number(bounds.getSouth().toFixed(6)),
        maxLat: Number(bounds.getNorth().toFixed(6)),
        minLng: Number(bounds.getWest().toFixed(6)),
        maxLng: Number(bounds.getEast().toFixed(6)),
      }
      const key = JSON.stringify(payload)
      if (key === lastKeyRef.current) return
      lastKeyRef.current = key
      zoomRef.current?.(payload.zoom)
      visibleBoundsRef.current?.(payload)
      callbackRef.current?.(payload)
    }
    function scheduleEmit() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(emit, 180)
    }
    emit()
    map.on('moveend', scheduleEmit)
    map.on('zoomend', scheduleEmit)
    return () => {
      map.off('moveend', scheduleEmit)
      map.off('zoomend', scheduleEmit)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [map])

  return null
}

function CornerMapControls() {
  const map = useMap()
  const [status, setStatus] = useState('idle')

  function zoomIn() { map.zoomIn() }
  function zoomOut() { map.zoomOut() }

  function locateUser() {
    if (!navigator?.geolocation) {
      setStatus('error')
      window.setTimeout(() => setStatus('idle'), 1800)
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        map.setView([latitude, longitude], Math.max(map.getZoom(), 12), { animate: true })
        setStatus('idle')
      },
      () => {
        setStatus('error')
        window.setTimeout(() => setStatus('idle'), 1800)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="map-corner-controls" aria-label="Kartensteuerung">
      <button type="button" className="map-corner-btn" onClick={zoomIn} aria-label="Vergrößern" title="Vergrößern"><Plus size={18} /></button>
      <button type="button" className="map-corner-btn" onClick={zoomOut} aria-label="Verkleinern" title="Verkleinern"><Minus size={18} /></button>
      <button type="button" className={`map-corner-btn map-locate-btn${status === 'loading' ? ' is-loading' : ''}`} onClick={locateUser} aria-label="Aktuellen Standort anzeigen" title="Aktuellen Standort anzeigen" disabled={status === 'loading'}>
        <LocateFixed size={18} />
      </button>
    </div>
  )
}

function MapResizer({ watchKey }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(timer)
  }, [map, watchKey])
  return null
}


function findPoiInEntries(entries = [], activePoiId = "") {
  if (!activePoiId) return null
  const target = String(activePoiId)
  for (const entry of entries || []) {
    const items = entry?.type === "cluster" ? entry.items : [entry?.item]
    for (const item of items || []) {
      if (!item) continue
      if (String(item.id || item.slug || "") === target) return item
    }
  }
  return null
}

function ActivePoiFocus({ markerEntries = [], activePoiId = "" }) {
  const map = useMap()
  const lastRef = useRef("")
  useEffect(() => {
    const poi = findPoiInEntries(markerEntries, activePoiId)
    if (!poi) return
    const lat = Number(poi.latitude)
    const lng = Number(poi.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const key = String(activePoiId) + "-" + lat.toFixed(6) + "-" + lng.toFixed(6)
    if (key === lastRef.current) return
    lastRef.current = key
    map.panTo([lat, lng], { animate: true, duration: 0.35 })
  }, [map, markerEntries, activePoiId])
  return null
}

export default function MapView({
  markerEntries = [],
  normalizedPois = [],
  onPick = null,
  pickedCoords = null,
  height = '100%',
  onViewportChange = null,
  onZoomChange = null,
  onVisibleBoundsChange = null,
  fullScreen = false,
  showTrailToggle = false,
  mapContext = 'default',
  navigationButtonsEnabled = true,
  navigationPlatform = 'none',
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapStyle, setMapStyle] = useState('street')
  const [activePoiId, setActivePoiId] = useState('')

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') setIsFullscreen(false) }
    if (isFullscreen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const initialCenter = useMemo(() => {
    if (pickedCoords?.lat && pickedCoords?.lng) return [pickedCoords.lat, pickedCoords.lng]
    const first = normalizedPois.find((p) => p.latitude && p.longitude)
    if (first) return [Number(first.latitude), Number(first.longitude)]
    return [39.5, -98.35]
  }, [pickedCoords?.lat, pickedCoords?.lng, normalizedPois])

  const showPoiSidebar = !onPick && markerEntries.length > 0
  const shellClassName = `map-shell${isFullscreen ? ' is-fullscreen' : ''}${showPoiSidebar ? ' has-poi-sidebar' : ''}`
  const effectiveHeight = isFullscreen ? '100vh' : height
  const tile = TILE_PRESETS[mapStyle] || TILE_PRESETS.street

  return (
    <div className={shellClassName} data-map-context={mapContext} style={{ position: isFullscreen ? 'fixed' : 'relative', height: effectiveHeight, width: '100%', minHeight: 420 }}>
      <MapControls mapStyle={mapStyle} setMapStyle={setMapStyle} fullScreen={fullScreen} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen} />
      {showPoiSidebar ? <FullscreenPoiSidebar markerEntries={markerEntries} activePoiId={activePoiId} onSelectPoi={setActivePoiId} compactMode={!isFullscreen} /> : null}
      <MapContainer center={initialCenter} zoom={4} zoomControl={false} scrollWheelZoom style={{ height: effectiveHeight, width: '100%', minHeight: 420 }}>
        <TileLayer attribution={tile.attribution} url={tile.url} />
        {(tile.overlays || []).map((overlay) => <TileLayer key={overlay.url} attribution={overlay.attribution} url={overlay.url} zIndex={overlay.zIndex || 2} />)}
        <ViewportTracker onViewportChange={onViewportChange} onZoomChange={onZoomChange} onVisibleBoundsChange={onVisibleBoundsChange} />
        <CornerMapControls />
        <MapResizer watchKey={`--`} />
        <ActivePoiFocus markerEntries={markerEntries} activePoiId={activePoiId} />
        {onPick ? <PickHandler onPick={onPick} /> : null}
        {markerEntries.map((entry, idx) => (
          <MapMarker
            key={entry.id || `${entry.type}-${idx}`}
            entry={entry}
            navigationButtonsEnabled={navigationButtonsEnabled}
            navigationPlatform={navigationPlatform}
            activePoiId={activePoiId}
            onActivatePoi={setActivePoiId}
          />
        ))}
        {pickedCoords?.lat && pickedCoords?.lng ? <Marker position={[pickedCoords.lat, pickedCoords.lng]} icon={iconForCategory('picked')}><Popup>Ausgewählter Punkt</Popup></Marker> : null}
      </MapContainer>
    </div>
  )
}
