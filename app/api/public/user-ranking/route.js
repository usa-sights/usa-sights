import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'
import { getPublicRankingVisible } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const BASE_CACHE_TTL_MS = 5 * 60 * 1000
const DETAILS_CACHE_TTL_MS = 60 * 1000
const CACHE_VERSION = 'step9-ranking-v1'

const baseCache = globalThis.__usaSightsPublicRankingBaseCache || { value: null, expiresAt: 0, promise: null }
globalThis.__usaSightsPublicRankingBaseCache = baseCache

const detailsCache = globalThis.__usaSightsPublicRankingDetailsCache || new Map()
globalThis.__usaSightsPublicRankingDetailsCache = detailsCache

function publicCacheHeaders(seconds = 300) {
  return {
    'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${Math.max(seconds * 3, 300)}`,
  }
}

function noStoreJson(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...(init.headers || {}),
    },
  })
}

function publicJson(body, seconds = 300, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      ...publicCacheHeaders(seconds),
      ...(init.headers || {}),
    },
  })
}

async function fetchAllRows(builderFactory, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const res = await builderFactory().range(from, from + pageSize - 1)
    if (res.error) throw res.error
    const batch = res.data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : false
}

function ensureRow(map, profilesById, userId) {
  if (!userId) return null
  if (!map.has(userId)) {
    const profile = profilesById.get(userId)
    map.set(userId, {
      id: userId,
      name: profile?.name || 'Nutzer',
      pois: 0,
      images: 0,
      links: 0,
      reviews: 0,
      comments: 0,
      total: 0,
      share: 0,
    })
  }
  return map.get(userId)
}

function buildRows(profiles, contributionRows) {
  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]))
  const map = new Map()

  for (const row of contributionRows.pois || []) {
    const item = ensureRow(map, profilesById, row.created_by)
    if (item) item.pois += 1
  }
  for (const row of contributionRows.images || []) {
    const item = ensureRow(map, profilesById, row.uploaded_by)
    if (item) item.images += 1
  }
  for (const row of contributionRows.links || []) {
    const item = ensureRow(map, profilesById, row.submitted_by)
    if (item) item.links += 1
  }
  for (const row of contributionRows.reviews || []) {
    const item = ensureRow(map, profilesById, row.user_id)
    if (item) item.reviews += 1
  }
  for (const row of contributionRows.replies || []) {
    const item = ensureRow(map, profilesById, row.user_id)
    if (item) item.comments += 1
  }

  const rows = Array.from(map.values()).filter((item) => item.pois || item.images || item.links || item.reviews || item.comments)
  const grandTotal = rows.reduce((sum, item) => sum + item.pois + item.images + item.links + item.reviews + item.comments, 0)
  return rows.map((item) => {
    const total = item.pois + item.images + item.links + item.reviews + item.comments
    return { ...item, total, share: grandTotal ? (total / grandTotal) * 100 : 0 }
  })
}

function sortRows(rows, sortKey = 'pois', sortDir = 'desc') {
  const factor = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
    return String(av || '').localeCompare(String(bv || '')) * factor
  })
}

async function signThumbs(admin, images = []) {
  const thumbPaths = Array.from(new Set(images.map((row) => deriveThumbPath(row.path)).filter(Boolean)))
  if (!thumbPaths.length) return {}
  const signed = await admin.storage.from('poi-images').createSignedUrls(thumbPaths, 3600)
  if (signed.error) return {}
  return Object.fromEntries((signed.data || []).map((entry, index) => [thumbPaths[index], entry.signedUrl]))
}

async function loadBaseRanking(admin) {
  const now = Date.now()
  if (baseCache.value && baseCache.expiresAt > now && baseCache.value.version === CACHE_VERSION) return baseCache.value.data
  if (baseCache.promise) return baseCache.promise

  baseCache.promise = (async () => {
    const [profiles, pois, images, links, reviews, replies] = await Promise.all([
      fetchAllRows(() => admin.from('profiles').select('id,name')),
      fetchAllRows(() => admin.from('pois').select('id,created_by').eq('status', 'published')),
      fetchAllRows(() => admin.from('poi_images').select('id,uploaded_by').eq('status', 'approved')),
      fetchAllRows(() => admin.from('poi_external_links').select('id,submitted_by').eq('status', 'published')),
      fetchAllRows(() => admin.from('poi_reviews').select('id,user_id')),
      fetchAllRows(() => admin.from('poi_review_replies').select('id,user_id')),
    ])

    const rows = buildRows(profiles, { pois, images, links, reviews, replies })
    const totalContributions = rows.reduce((sum, item) => sum + item.total, 0)
    const data = { rows, totals: { users: rows.length, contributions: totalContributions } }
    baseCache.value = { version: CACHE_VERSION, data, expiresAt: Date.now() + BASE_CACHE_TTL_MS }
    baseCache.expiresAt = Date.now() + BASE_CACHE_TTL_MS
    return data
  })()

  try {
    return await baseCache.promise
  } finally {
    baseCache.promise = null
  }
}

async function loadDetails(admin, userId, contentType) {
  if (!userId || !contentType) return []
  const cacheKey = `${CACHE_VERSION}:${userId}:${contentType}`
  const now = Date.now()
  const cached = detailsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.value

  let details = []
  if (contentType === 'pois') {
    const pois = await fetchAllRows(() => admin
      .from('pois')
      .select('id,title,slug,created_by,created_at')
      .eq('status', 'published')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }))
    details = pois.map((row) => ({
      id: row.id,
      title: row.title,
      href: row.slug ? `/poi/${row.slug}` : null,
      created_at: row.created_at,
      meta: 'Veröffentlichter POI',
      kind: 'poi',
    }))
  } else if (contentType === 'images') {
    const userImages = await fetchAllRows(() => admin
      .from('poi_images')
      .select('id,poi_id,uploaded_by,created_at,status,caption,path, pois(title,slug)')
      .eq('status', 'approved')
      .eq('uploaded_by', userId)
      .order('created_at', { ascending: false }))
    const thumbUrls = await signThumbs(admin, userImages)
    details = userImages.map((row) => ({
      id: row.id,
      title: row.pois?.title || row.caption || 'Bild',
      href: row.pois?.slug ? `/poi/${row.pois.slug}` : null,
      created_at: row.created_at,
      meta: row.caption || 'Freigegebenes Bild',
      kind: 'image',
      thumb_url: thumbUrls[deriveThumbPath(row.path)] || null,
    }))
  } else if (contentType === 'links') {
    const links = await fetchAllRows(() => admin
      .from('poi_external_links')
      .select('id,poi_id,submitted_by,created_at,status,label,url, pois(title,slug)')
      .eq('status', 'published')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false }))
    details = links.map((row) => ({
      id: row.id,
      title: row.label || row.url,
      href: row.pois?.slug ? `/poi/${row.pois.slug}` : null,
      created_at: row.created_at,
      meta: row.pois?.title || 'Veröffentlichter Link',
      kind: 'link',
      url: row.url,
    }))
  } else if (contentType === 'reviews') {
    const reviews = await fetchAllRows(() => admin
      .from('poi_reviews')
      .select('id,poi_id,user_id,created_at,rating,review_text, pois(title,slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }))
    details = reviews.map((row) => ({
      id: row.id,
      title: row.pois?.title || 'Bewertung',
      href: row.pois?.slug ? `/poi/${row.pois.slug}#review-${row.id}` : null,
      created_at: row.created_at,
      meta: hasText(row.review_text) ? `Bewertung mit Text · ${row.rating || 0}★` : `Bewertung · ${row.rating || 0}★`,
      kind: 'review',
    }))
  } else if (contentType === 'comments') {
    const replies = await fetchAllRows(() => admin
      .from('poi_review_replies')
      .select('id,review_id,user_id,created_at,reply_text, poi_reviews(poi_id, pois(title,slug))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }))
    details = replies.map((row) => ({
      id: row.id,
      title: row.poi_reviews?.pois?.title || 'Kommentar',
      href: row.poi_reviews?.pois?.slug ? `/poi/${row.poi_reviews.pois.slug}#reply-${row.id}` : null,
      created_at: row.created_at,
      meta: 'Kommentar / Antwort',
      kind: 'comment',
    }))
  }

  detailsCache.set(cacheKey, { value: details, expiresAt: Date.now() + DETAILS_CACHE_TTL_MS })
  return details
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const sortKey = searchParams.get('sort') || 'pois'
  const sortDir = searchParams.get('dir') || 'desc'
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('page_size') || 25)))
  const userId = searchParams.get('user_id') || ''
  const contentType = searchParams.get('content_type') || ''

  try {
    const rankingSetting = await getPublicRankingVisible(admin)
    if (!rankingSetting.value) {
      return publicJson({ enabled: false, items: [], total: 0, page, pageSize, totals: { users: 0, contributions: 0 }, details: [] }, 60)
    }

    const { rows, totals } = await loadBaseRanking(admin)
    const sortedRows = sortRows(rows, sortKey, sortDir)
    const total = sortedRows.length
    const start = (page - 1) * pageSize
    const items = sortedRows.slice(start, start + pageSize)
    const details = userId && contentType ? await loadDetails(admin, userId, contentType) : []

    return publicJson({ enabled: true, items, total, page, pageSize, totals, details }, userId && contentType ? 60 : 300)
  } catch (error) {
    console.error('public user ranking failed', error)
    return noStoreJson({ error: error.message || 'Ranking konnte nicht geladen werden.', enabled: false, items: [], total: 0, page, pageSize, totals: { users: 0, contributions: 0 }, details: [] }, { status: 500 })
  }
}
