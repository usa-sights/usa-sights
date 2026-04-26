export function getClusterThreshold(zoom) {
  if (zoom <= 4) return 0.7
  if (zoom <= 5) return 0.45
  if (zoom <= 6) return 0.22
  if (zoom <= 7) return 0.12
  if (zoom <= 8) return 0.07
  if (zoom <= 10) return 0.02
  if (zoom <= 12) return 0.006
  if (zoom <= 14) return 0.0015
  if (zoom <= 16) return 0.00035
  return 0.00001
}

export function coordinateKey(item) {
  const lat = Number(item.latitude)
  const lng = Number(item.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  return `${lat.toFixed(6)}_${lng.toFixed(6)}`
}

export function isInBounds(item, bounds, paddingRatio = 0.3) {
  if (!bounds) return true
  const lat = Number(item.latitude)
  const lng = Number(item.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  const latSpan = Math.max(Math.abs(bounds.maxLat - bounds.minLat), 0.01)
  const lngSpan = Math.max(Math.abs(bounds.maxLng - bounds.minLng), 0.01)
  const latPad = latSpan * paddingRatio
  const lngPad = lngSpan * paddingRatio
  return lat >= bounds.minLat - latPad && lat <= bounds.maxLat + latPad && lng >= bounds.minLng - lngPad && lng <= bounds.maxLng + lngPad
}

export function clusterPoints(points, zoom = 4) {
  const threshold = getClusterThreshold(zoom)
  const buckets = new Map()

  for (const p of points || []) {
    const lat = Number(p.latitude)
    const lng = Number(p.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const exactKey = coordinateKey(p)
    const proximityKey = `${Math.round(lat / threshold)}_${Math.round(lng / threshold)}`
    const key = zoom >= 17 ? exactKey : proximityKey

    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(p)
  }

  return Array.from(buckets.values()).map((items) => {
    if (items.length === 1) return { type: 'point', item: items[0], id: String(items[0].id || items[0].slug) }
    const lat = items.reduce((s, x) => s + Number(x.latitude), 0) / items.length
    const lng = items.reduce((s, x) => s + Number(x.longitude), 0) / items.length
    return { type: 'cluster', items, lat, lng, id: items.map((item) => item.id || item.slug).join('|') }
  })
}

export function entryIsInBounds(entry, bounds, paddingRatio = 0.3) {
  if (!bounds) return true
  if (entry.type === 'cluster') {
    if (isInBounds({ latitude: entry.lat, longitude: entry.lng }, bounds, paddingRatio)) return true
    return (entry.items || []).some((item) => isInBounds(item, bounds, paddingRatio))
  }
  return isInBounds(entry.item, bounds, paddingRatio)
}

export function getVisibleClusterEntries(clusterEntries, bounds, paddingRatio = 0.3) {
  return bounds ? (clusterEntries || []).filter((entry) => entryIsInBounds(entry, bounds, paddingRatio)) : (clusterEntries || [])
}
