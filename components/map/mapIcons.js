import L from 'leaflet'

const categoryIconCache = new Map()
const clusterIconCache = new Map()

function emojiForCategory(name) {
  const key = String(name || '').toLowerCase()
  if (key.includes('natur')) return '🌲'
  if (key.includes('stadt')) return '🏙️'
  if (key.includes('museum')) return '🏛️'
  if (key.includes('strand')) return '🏖️'
  if (key.includes('aktiv')) return '🎯'
  if (key.includes('aussicht')) return '👀'
  if (key.includes('park')) return '🌳'
  return '📍'
}

export function iconForCategory(name) {
  const emoji = emojiForCategory(name)
  if (categoryIconCache.has(emoji)) return categoryIconCache.get(emoji)

  const icon = L.divIcon({
    className: '',
    html: `<div class="map-marker-pin" aria-hidden="true">${emoji}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -12],
  })
  categoryIconCache.set(emoji, icon)
  return icon
}

export function clusterIcon(count) {
  const safeCount = Math.max(2, Number(count) || 2)
  const label = safeCount > 99 ? '99+' : String(safeCount)
  if (clusterIconCache.has(label)) return clusterIconCache.get(label)

  const icon = L.divIcon({
    className: '',
    html: `<div class="map-marker-cluster" aria-hidden="true">${label}</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -12],
  })
  clusterIconCache.set(label, icon)
  return icon
}
