'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { authFetchJson } from '@/utils/authFetch'
import ExploreMap from '@/components/ExploreMap'
import { getPreviewImageUrl } from '@/lib/map/poiUtils'

function escapeXml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function validCoords(poi) {
  const lat = Number(poi?.latitude ?? poi?.lat)
  const lng = Number(poi?.longitude ?? poi?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function buildGpx(points = []) {
  const waypoints = points.map((poi) => {
    const coords = validCoords(poi)
    if (!coords) return ''
    const desc = [poi.short_description, poi.city, poi.state].filter(Boolean).join(' · ')
    return `  <wpt lat="${coords.lat}" lon="${coords.lng}">\n    <name>${escapeXml(poi.title || 'POI')}</name>\n    <desc>${escapeXml(desc)}</desc>\n    <link href="${escapeXml(`${window.location.origin}/poi/${poi.slug || ''}`)}" />\n  </wpt>`
  }).filter(Boolean).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="USA Sights" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>USA Sights Favoriten</name></metadata>\n${waypoints}\n</gpx>`
}

function buildKml(points = []) {
  const placemarks = points.map((poi) => {
    const coords = validCoords(poi)
    if (!coords) return ''
    const desc = [poi.short_description, poi.city, poi.state, poi.slug ? `${window.location.origin}/poi/${poi.slug}` : ''].filter(Boolean).join('<br/>')
    return `    <Placemark>\n      <name>${escapeXml(poi.title || 'POI')}</name>\n      <description>${escapeXml(desc)}</description>\n      <Point><coordinates>${coords.lng},${coords.lat},0</coordinates></Point>\n    </Placemark>`
  }).filter(Boolean).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>USA Sights Favoriten</name>\n${placemarks}\n  </Document>\n</kml>`
}

function downloadText(filename, mime, content) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function qrUrl(text) {
  return `https://quickchart.io/qr?size=180&margin=1&text=${encodeURIComponent(text)}`
}

function FavoritesDownloadModal({ points, onClose }) {
  const first = points[0] || null
  const thumb = first ? getPreviewImageUrl(first) : ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://usa-sights.com'
  const gpxHref = `${origin}/account/favorites?download=gpx`
  const kmlHref = `${origin}/account/favorites?download=kml`

  const downloadGpx = useCallback(() => downloadText('usa-sights-favoriten.gpx', 'application/gpx+xml;charset=utf-8', buildGpx(points)), [points])
  const downloadKml = useCallback(() => downloadText('usa-sights-favoriten.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8', buildKml(points)), [points])

  return (
    <div className="favorites-download-backdrop" role="dialog" aria-modal="true" aria-label="Favoriten herunterladen" onClick={onClose}>
      <div className="favorites-download-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="favorites-download-close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        <h2 className="favorites-download-title">Download</h2>
        <div className="favorites-download-summary">
          {thumb ? <img src={thumb} alt="" /> : <span />}
          <div>
            <strong>{points.length.toLocaleString('de-DE')} gespeicherte POIs</strong>
            <span>Favoriten mit Koordinaten, Beschreibung und Detail-Link</span>
          </div>
        </div>
        <div className="favorites-download-options">
          <div className="favorites-download-card">
            <h3>GPX</h3>
            <p>GPS Exchange Format (XML)</p>
            <img src={qrUrl(gpxHref)} alt="QR-Code für GPX Download" />
            <button type="button" onClick={downloadGpx}>Download</button>
          </div>
          <div className="favorites-download-card">
            <h3>KML</h3>
            <p>Google Earth, Google Maps</p>
            <img src={qrUrl(kmlHref)} alt="QR-Code für KML Download" />
            <button type="button" onClick={downloadKml}>Download</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FavoritesClient() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [downloadOpen, setDownloadOpen] = useState(false)

  useEffect(() => {
    authFetchJson('/api/me/favorites')
      .then((data) => data.error ? setMessage(data.error) : setItems(data.items || []))
      .catch((e) => setMessage(e.message))
  }, [])

  const points = useMemo(() => items.map((item) => ({ ...item.pois, favorite_id: item.id, id: item.pois?.id || item.poi_id || item.id })), [items])

  useEffect(() => {
    if (!points.length || typeof window === 'undefined') return
    const mode = new URLSearchParams(window.location.search).get('download')
    if (mode === 'gpx') downloadText('usa-sights-favoriten.gpx', 'application/gpx+xml;charset=utf-8', buildGpx(points))
    if (mode === 'kml') downloadText('usa-sights-favoriten.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8', buildKml(points))
  }, [points])

  return (
    <main className="favorites-shell">
      <div className="favorites-head">
        <div className="container">
          <h1>Favoriten</h1>
          {message && <div className="notice">{message}</div>}
        </div>
      </div>
      {points.length ? (
        <>
          <div className="favorites-toolbar">
            <button type="button" className="favorites-export-btn" onClick={() => setDownloadOpen(true)}><Download size={17} />GPX/KML Download</button>
          </div>
          <div className="favorites-map-wrap">
            <ExploreMap points={points} fullScreen showTrailToggle mapContext="favorites" />
          </div>
          {downloadOpen ? <FavoritesDownloadModal points={points} onClose={() => setDownloadOpen(false)} /> : null}
        </>
      ) : (
        <div className="container"><div className="card">Keine Favoriten vorhanden.</div></div>
      )}
    </main>
  )
}
