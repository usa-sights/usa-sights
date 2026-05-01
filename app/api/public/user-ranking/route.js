import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'
import { getPublicRankingVisible } from '@/lib/appSettings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

async function fetchAllRows(builderFactory, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const res = await builderFactory().range(from, from + pageSize - 1)
    if (res.error) break
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

function buildRows(profiles, pois, images, links, reviews, replies) {
  const map = new Map((profiles || []).map((profile) => [profile.id, {
    id: profile.id,
    name: profile.name || 'Nutzer',
    pois: 0,
    images: 0,
    links: 0,
    reviews: 0,
    comments: 0,
    total: 0,
    share: 0,
  }]))

  function ensure(userId) {
    if (!userId) return null
    if (!map.has(userId)) map.set(userId, { id: userId, name: 'Nutzer', pois: 0, images: 0, links: 0, reviews: 0, comments: 0, total: 0, share: 0 })
    return map.get(userId)
  }

  for (const row of pois || []) {
    const item = ensure(row.created_by)
    if (item) item.pois += 1
  }
  for (const row of images || []) {
    const item = ensure(row.uploaded_by)
    if (item) item.images += 1
  }
  for (const row of links || []) {
    const item = ensure(row.submitted_by)
    if (item) item.links += 1
  }
  for (const row of reviews || []) {
    const item = ensure(row.user_id)
    if (item) item.reviews += 1
  }
  for (const row of replies || []) {
    const item = ensure(row.user_id)
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

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)
  const sortKey = searchParams.get('sort') || 'pois'
  const sortDir = searchParams.get('dir') || 'desc'
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('page_size') || 25)))
  const userId = searchParams.get('user_id') || ''
  const contentType = searchParams.get('content_type') || ''

  const rankingSetting = await getPublicRankingVisible(admin)
  if (!rankingSetting.value) {
    return noStoreJson({ enabled: false, items: [], total: 0, page, pageSize, totals: { users: 0, contributions: 0 }, details: [] })
  }

  const [profiles, pois, images, links, reviews, replies] = await Promise.all([
    fetchAllRows(() => admin.from('profiles').select('id,name')),
    fetchAllRows(() => admin.from('pois').select('id,title,slug,created_by,created_at').eq('status', 'published')),
    fetchAllRows(() => admin.from('poi_images').select('id,poi_id,uploaded_by,created_at,status,caption,path, pois(title,slug)').eq('status', 'approved')),
    fetchAllRows(() => admin.from('poi_external_links').select('id,poi_id,submitted_by,created_at,status,label,url, pois(title,slug)').eq('status', 'published')),
    fetchAllRows(() => admin.from('poi_reviews').select('id,poi_id,user_id,created_at,rating,review_text, pois(title,slug)')),
    fetchAllRows(() => admin.from('poi_review_replies').select('id,review_id,user_id,created_at,reply_text, poi_reviews(poi_id, pois(title,slug))')),
  ])

  const rows = sortRows(buildRows(profiles, pois, images, links, reviews, replies), sortKey, sortDir)
  const total = rows.length
  const start = (page - 1) * pageSize
  const items = rows.slice(start, start + pageSize)
  const totalContributions = rows.reduce((sum, item) => sum + item.total, 0)

  let details = []
  if (userId && contentType) {
    if (contentType === 'pois') {
      details = (pois || []).filter((row) => row.created_by === userId).map((row) => ({
        id: row.id,
        title: row.title,
        href: row.slug ? `/poi/${row.slug}` : null,
        created_at: row.created_at,
        meta: 'Veröffentlichter POI',
        kind: 'poi',
      }))
    } else if (contentType === 'images') {
      const userImages = (images || []).filter((row) => row.uploaded_by === userId)
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
      details = (links || []).filter((row) => row.submitted_by === userId).map((row) => ({
        id: row.id,
        title: row.label || row.url,
        href: row.pois?.slug ? `/poi/${row.pois.slug}` : null,
        created_at: row.created_at,
        meta: row.pois?.title || 'Veröffentlichter Link',
        kind: 'link',
        url: row.url,
      }))
    } else if (contentType === 'reviews') {
      details = (reviews || []).filter((row) => row.user_id === userId).map((row) => ({
        id: row.id,
        title: row.pois?.title || 'Bewertung',
        href: row.pois?.slug ? `/poi/${row.pois.slug}#review-${row.id}` : null,
        created_at: row.created_at,
        meta: hasText(row.review_text) ? `Bewertung mit Text · ${row.rating || 0}★` : `Bewertung · ${row.rating || 0}★`,
        kind: 'review',
      }))
    } else if (contentType === 'comments') {
      details = (replies || []).filter((row) => row.user_id === userId).map((row) => ({
        id: row.id,
        title: row.poi_reviews?.pois?.title || 'Kommentar',
        href: row.poi_reviews?.pois?.slug ? `/poi/${row.poi_reviews.pois.slug}#reply-${row.id}` : null,
        created_at: row.created_at,
        meta: 'Kommentar / Antwort',
        kind: 'comment',
      }))
    }
  }

  return noStoreJson({ enabled: true, items, total, page, pageSize, totals: { users: rows.length, contributions: totalContributions }, details })
}
