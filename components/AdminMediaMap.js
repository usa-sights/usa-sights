'use client'

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { authFetchJson } from '@/utils/authFetch'

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(15,23,42,.25)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const icons = {
  pending: makeIcon('#f59e0b'),
  approved: makeIcon('#16a34a'),
  rejected: makeIcon('#dc2626'),
}

export default function AdminMediaMap({ items = [], onUpdated = null }) {
  const points = items.filter((x) => x.pois?.latitude && x.pois?.longitude)
  if (!points.length) return null

  async function updateImage(id, payload) {
    const data = await authFetchJson('/api/admin/media', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    })
    if (!data.error) onUpdated?.()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
        <strong>Medienkarte</strong>
        <span className="muted" style={{ marginLeft: 10 }}>Grün = approved, Orange = pending, Rot = rejected</span>
      </div>
      <div style={{ height: 420 }}>
        <MapContainer center={[39.5, -98.35]} zoom={4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((item) => (
            <Marker
              key={item.id}
              position={[Number(item.pois.latitude), Number(item.pois.longitude)]}
              icon={icons[item.status] || icons.pending}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{item.pois?.title || 'POI'}</strong>
                  <p style={{ margin: '6px 0' }}>{item.status}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => updateImage(item.id, { status: 'approved' })}>Freigeben</button>
                    <button className="btn btn-danger" onClick={() => updateImage(item.id, { status: 'rejected' })}>Ablehnen</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
