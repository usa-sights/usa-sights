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

export function iconForCategory(name, { active = false } = {}) {
  const emoji = emojiForCategory(name)
  const key = `${emoji}:${active ? 'active' : 'normal'}`
  if (categoryIconCache.has(key)) return categoryIconCache.get(key)

  const icon = L.divIcon({
    className: '',
    html: `<div class="map-marker-pin${active ? ' is-active' : ''}" aria-hidden="true">${emoji}</div>`,
    iconSize: active ? [40, 40] : [32, 32],
    iconAnchor: active ? [20, 20] : [16, 16],
    popupAnchor: [0, -12],
  })
  categoryIconCache.set(key, icon)
  return icon
}

export function clusterIcon(count, { active = false } = {}) {
  const safeCount = Math.max(2, Number(count) || 2)
  const label = safeCount > 99 ? '99+' : String(safeCount)
  const key = `${label}:${active ? 'active' : 'normal'}`
  if (clusterIconCache.has(key)) return clusterIconCache.get(key)

  const icon = L.divIcon({
    className: '',
    html: `<div class="map-marker-cluster${active ? ' is-active' : ''}" aria-hidden="true">${label}</div>`,
    iconSize: active ? [48, 48] : [40, 40],
    iconAnchor: active ? [24, 24] : [20, 20],
    popupAnchor: [0, -12],
  })
  clusterIconCache.set(key, icon)
  return icon
}
