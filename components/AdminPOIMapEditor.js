'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

function createAdminMarker(L) {
  return L.divIcon({
    className: 'admin-map-marker-wrap',
    html: '<div class="admin-map-marker-pin"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

export default function AdminPOIMapEditor({ latitude, longitude, onChange, mapKey = 'default' }) {
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const elRef = useRef(null)
  const leafletRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!elRef.current || mapRef.current || typeof window === 'undefined') return
      const mod = await import('leaflet')
      const L = mod.default || mod
      leafletRef.current = L
      if (cancelled || !elRef.current) return
      const lat = Number(latitude) || 39.8283
      const lng = Number(longitude) || -98.5795
      const map = L.map(elRef.current).setView([lat, lng], latitude && longitude ? 13 : 4)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
      const marker = L.marker([lat, lng], { draggable: true, icon: createAdminMarker(L) }).addTo(map)
      marker.on('dragend', () => { const pos = marker.getLatLng(); onChange?.({ latitude: Number(pos.lat.toFixed(6)), longitude: Number(pos.lng.toFixed(6)) }) })
      map.on('click', (e) => { marker.setLatLng(e.latlng); onChange?.({ latitude: Number(e.latlng.lat.toFixed(6)), longitude: Number(e.latlng.lng.toFixed(6)) }) })
      mapRef.current = map; markerRef.current = marker; setTimeout(() => map.invalidateSize(), 60)
    }
    init()
    return () => { cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      markerRef.current = null; leafletRef.current = null }
  }, [mapKey])

  useEffect(() => {
    const L = leafletRef.current
    if (!L || !mapRef.current || !markerRef.current) return
    const next = L.latLng(Number(latitude) || 39.8283, Number(longitude) || -98.5795)
    markerRef.current.setLatLng(next)
    mapRef.current.setView(next, mapRef.current.getZoom())
    setTimeout(() => mapRef.current?.invalidateSize(), 0)
  }, [latitude, longitude])

  return <div className="card" style={{ marginTop: 16 }}><h3>POI-Position auf Karte</h3><p className="muted">Marker verschieben oder auf die Karte klicken, um Latitude und Longitude zu setzen.</p><div ref={elRef} style={{ height: 360, width: '100%', borderRadius: 12, overflow: 'hidden' }} /></div>
}
