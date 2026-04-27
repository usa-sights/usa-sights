import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { deriveThumbPath } from '@/lib/imageUpload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toNum(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

async function buildImageMap(admin, items = [], includeImages = false) {
  if (!items.length) return {}
  const poiIds = items.map((x) => x.id).filter(Boolean)
  if (!poiIds.length) return {}

  const imagesRes = await admin
    .from('poi_images')
    .select('poi_id,path,is_cover,created_at')
    .in('poi_id', poiIds)
    .eq('status', 'approved')
    .order('is_cover', { ascending: false })
    .order('created_at', { ascending: false })

  const chosen = new Map()
  for (const img of (imagesRes.data || [])) {
    if (!chosen.has(img.poi_id)) chosen.set(img.poi_id, img)
  }
  if (!chosen.size) return {}

  if (!includeImages) {
    return Object.fromEntries(Array.from(chosen.entries()).map(([poiId, img]) => [poiId, {
      cover_path: img.path,
      cover_thumb_path: deriveThumbPath(img.path),
      image_sources: [],
    }]))
  }

  const paths = Array.from(new Set(Array.from(chosen.values()).flatMap((img) => [deriveThumbPath(img.path), img.path]).filter(Boolean)))
  let signedMap = {}
  if (paths.length) {
    const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
    if (!signed.error) {
      signedMap = Object.fromEntries((signed.data || []).map((entry, idx) => [paths[idx], entry.signedUrl]))
    }
  }

  return Object.fromEntries(Array.from(chosen.entries()).map(([poiId, img]) => {
    const thumbPath = deriveThumbPath(img.path)
    const thumbUrl = signedMap[thumbPath] || null
    const coverUrl = signedMap[img.path] || null
    return [poiId, {
      cover_url: coverUrl,
      cover_thumb_url: thumbUrl || coverUrl || null,
      cover_path: img.path,
      cover_thumb_path: thumbPath,
      image_sources: [thumbUrl, coverUrl].filter(Boolean),
    }]
  }))
}

async function buildReviewStats(admin, items = []) {
  const poiIds = items.map((x) => x.id).filter(Boolean)
  if (!poiIds.length) return {}

  const { data: reviews } = await admin
    .from('poi_reviews')
    .select('id,poi_id,rating,review_text')
    .in('poi_id', poiIds)

  const byPoi = new Map()
  const reviewIds = []
  for (const review of (reviews || [])) {
    reviewIds.push(review.id)
    const current = byPoi.get(review.poi_id) || { ratingSum: 0, ratingCount: 0, commentCount: 0, reviewIds: [] }
    const rating = Number(review.rating || 0)
    if (rating > 0) {
      current.ratingSum += rating
      current.ratingCount += 1
    }
    if (String(review.review_text || '').trim()) current.commentCount += 1
    current.reviewIds.push(review.id)
    byPoi.set(review.poi_id, current)
  }

  if (reviewIds.length) {
    const { data: replies } = await admin
      .from('poi_review_replies')
      .select('review_id')
      .in('review_id', reviewIds)

    const reviewToPoi = new Map()
    for (const [poiId, stats] of byPoi.entries()) {
      for (const reviewId of stats.reviewIds) reviewToPoi.set(reviewId, poiId)
    }
    for (const reply of (replies || [])) {
      const poiId = reviewToPoi.get(reply.review_id)
      if (!poiId) continue
      const current = byPoi.get(poiId)
      if (current) current.commentCount += 1
    }
  }

  return Object.fromEntries(Array.from(byPoi.entries()).map(([poiId, stats]) => [poiId, {
    rating_average: stats.ratingCount ? stats.ratingSum / stats.ratingCount : null,
    rating_count: stats.ratingCount,
    comment_count: stats.commentCount,
  }]))
}

export async function GET(req) {
  const admin = createSupabaseAdminClient()
  const { searchParams } = new URL(req.url)

  const categoryId = searchParams.get('category_id')
  const q = searchParams.get('q')
  const state = searchParams.get('state')
  const includeImages = searchParams.get('include_images') === '1'

  const minLat = toNum(searchParams.get('minLat'))
  const maxLat = toNum(searchParams.get('maxLat'))
  const minLng = toNum(searchParams.get('minLng'))
  const maxLng = toNum(searchParams.get('maxLng'))

  const limit = Math.min(Number(searchParams.get('limit') || 300), 800)
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

  let query = admin
    .from('pois')
    .select('id,title,slug,short_description,city,state,address,latitude,longitude,categories(name)', { count: 'exact' })
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId) query = query.eq('category_id', categoryId)
  if (state) query = query.eq('state', state)
  if (q) query = query.or(`title.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,address.ilike.%${q}%`)
  if (minLat !== null && maxLat !== null) query = query.gte('latitude', minLat).lte('latitude', maxLat)
  if (minLng !== null && maxLng !== null) query = query.gte('longitude', minLng).lte('longitude', maxLng)

  const { data, error, count } = await query
  if (error) return Response.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })

  const items = data || []
  const [imageMap, statsMap] = await Promise.all([
    buildImageMap(admin, items, includeImages),
    buildReviewStats(admin, items),
  ])

  return Response.json({
    items: items.map((item) => {
      const image = imageMap[item.id] || {}
      const stats = statsMap[item.id] || {}
      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        lat: item.latitude,
        lng: item.longitude,
        latitude: item.latitude,
        longitude: item.longitude,
        category: item.categories?.name || '',
        categories: item.categories || null,
        image: image.cover_thumb_url || image.cover_url || '',
        image_sources: image.image_sources || [],
        cover_thumb_url: image.cover_thumb_url || null,
        cover_url: image.cover_url || null,
        cover_thumb_path: image.cover_thumb_path || null,
        cover_path: image.cover_path || null,
        city: item.city || '',
        state: item.state || '',
        address: item.address || '',
        short_description: item.short_description || '',
        rating_average: stats.rating_average || null,
        rating_count: stats.rating_count || 0,
        comment_count: stats.comment_count || 0,
      }
    }),
    total: count || 0,
    limit,
    offset,
    has_more: (offset + limit) < (count || 0)
  }, { headers: noStoreHeaders() })
}
