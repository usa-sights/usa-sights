export function isFiniteCoordinate(value) {
  const n = Number(value)
  return Number.isFinite(n)
}

export function withCacheBust(url, id) {
  if (!url || typeof url !== 'string') return ''
  if (/^(data:|blob:)/i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(id || ''))}`
}

export function optimizeImageUrl(url, { width = 320, height = 180 } = {}) {
  if (!url || typeof url !== 'string') return null
  // Supabase image transformation is supported through the render/image endpoint.
  // Signed URLs or unknown origins are returned unchanged to avoid breaking private images.
  if (/\/storage\/v1\/object\/public\//.test(url) && !/\/render\/image\//.test(url)) {
    const nextUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const separator = nextUrl.includes('?') ? '&' : '?'
    return `${nextUrl}${separator}width=${width}&height=${height}&resize=cover&quality=72`
  }
  return url
}

export function getPreviewImageCandidates(item, options = {}) {
  const width = options.width || 320
  const height = options.height || 180
  const rawCandidates = [
    ...(Array.isArray(item?.image_sources) ? item.image_sources : []),
    item?.previewImageUrl,
    item?.cover_thumb_url,
    item?.image,
    item?.cover_url,
    item?.image_url,
    item?.thumbnail_url,
  ]
  const seen = new Set()
  return rawCandidates
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => optimizeImageUrl(withCacheBust(url.trim(), item?.id || item?.slug || ''), { width, height }))
    .filter(Boolean)
    .filter((url) => {
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })
}

export function getPreviewImageUrl(item) {
  return getPreviewImageCandidates(item)[0] || null
}

export function getPoiHref(item) {
  return item?.slug ? `/poi/${encodeURIComponent(String(item.slug))}` : '#'
}

export function getPoiReviewHref(item) {
  const href = getPoiHref(item)
  return href === '#' ? href : `${href}#poi-reviews`
}

export function getCategoryName(raw = {}) {
  if (typeof raw.category === 'string') return raw.category
  if (typeof raw.categories === 'string') return raw.categories
  return raw.categories?.name || raw.category?.name || ''
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizePoi(raw = {}) {
  const latitude = Number(raw.latitude ?? raw.lat)
  const longitude = Number(raw.longitude ?? raw.lng ?? raw.lon)
  const categoryName = getCategoryName(raw)
  const imageCandidates = getPreviewImageCandidates(raw)
  const ratingAverage = toNumberOrNull(raw.rating_average ?? raw.average_rating ?? raw.review_average)
  const ratingCount = Number(raw.rating_count ?? raw.review_count ?? raw.reviews_count ?? 0) || 0
  const commentCount = Number(raw.comment_count ?? raw.comments_count ?? raw.review_comment_count ?? 0) || 0

  return {
    id: raw.id ?? raw.slug ?? `${raw.title || raw.name || 'poi'}-${latitude}-${longitude}`,
    title: raw.title || raw.name || 'POI',
    slug: raw.slug || '',
    latitude,
    longitude,
    category: categoryName,
    categories: categoryName ? { name: categoryName } : null,
    image: raw.image || raw.cover_thumb_url || raw.cover_url || raw.image_url || raw.thumbnail_url || '',
    image_sources: imageCandidates,
    previewImageUrl: imageCandidates[0] || null,
    cover_thumb_url: raw.cover_thumb_url || '',
    cover_url: raw.cover_url || '',
    image_url: raw.image_url || '',
    thumbnail_url: raw.thumbnail_url || '',
    cover_thumb_path: raw.cover_thumb_path || '',
    cover_path: raw.cover_path || '',
    city: raw.city || '',
    state: raw.state || '',
    address: raw.address || '',
    short_description: raw.short_description || raw.description || categoryName || '',
    rating_average: ratingAverage,
    rating_count: ratingCount,
    comment_count: commentCount,
    favorite_id: raw.favorite_id || null,
  }
}

export function normalizePois(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(normalizePoi)
    .filter((item) => isFiniteCoordinate(item.latitude) && isFiniteCoordinate(item.longitude))
}

export function sortPoisByTitle(items = []) {
  return [...items].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'))
}

export function buildAddress(item) {
  return [item?.address, item?.city, item?.state].filter(Boolean).join(', ')
}

export function buildGoogleUrl(item) {
  const target = buildAddress(item) || `${item?.latitude},${item?.longitude}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`
}

export function buildAppleUrl(item) {
  const target = buildAddress(item) || `${item?.latitude},${item?.longitude}`
  return `https://maps.apple.com/?daddr=${encodeURIComponent(target)}&dirflg=d`
}

export function getNavigationButtons(item, enabled = true) {
  if (!enabled) return []
  return [
    { key: 'apple', label: 'Apple Maps', url: buildAppleUrl(item) },
    { key: 'google', label: 'Google Maps', url: buildGoogleUrl(item) },
  ]
}

export function detectNavigationPlatform() {
  if (typeof window === 'undefined') return 'none'
  const ua = window.navigator.userAgent || ''
  const platform = window.navigator.platform || ''
  const touchPoints = Number(window.navigator.maxTouchPoints || 0)
  const isiOS = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1)
  const isAndroid = /Android/i.test(ua)
  if (isiOS) return 'apple'
  if (isAndroid) return 'google'
  return 'none'
}
