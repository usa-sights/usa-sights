import { requireUserRoute } from '@/utils/supabase/auth'
import { deriveThumbPath } from '@/lib/imageUpload'

async function getFavoriteImageMap(admin, poiIds = []) {
  if (!poiIds.length) return {}

  const { data: images, error } = await admin
    .from('poi_images')
    .select('poi_id,path,is_cover,created_at')
    .in('poi_id', poiIds)
    .eq('status', 'approved')
    .order('is_cover', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !images?.length) return {}

  const chosen = new Map()
  for (const image of images) {
    if (!chosen.has(image.poi_id)) chosen.set(image.poi_id, image)
  }

  const paths = Array.from(new Set(
    Array.from(chosen.values())
      .flatMap((image) => [deriveThumbPath(image.path), image.path])
      .filter(Boolean)
  ))

  let signedMap = {}
  if (paths.length) {
    const signed = await admin.storage.from('poi-images').createSignedUrls(paths, 3600)
    if (!signed.error) {
      signedMap = Object.fromEntries((signed.data || []).map((entry, idx) => [paths[idx], entry.signedUrl]))
    }
  }

  return Object.fromEntries(Array.from(chosen.entries()).map(([poiId, image]) => {
    const thumbPath = deriveThumbPath(image.path)
    return [poiId, {
      cover_thumb_url: signedMap[thumbPath] || signedMap[image.path] || null,
      cover_url: signedMap[image.path] || null,
      cover_thumb_path: thumbPath,
      cover_path: image.path,
    }]
  }))
}

async function buildFavoriteReviewStats(admin, poiIds = []) {
  if (!poiIds.length) return {}

  const { data: reviews } = await admin
    .from('poi_reviews')
    .select('id,poi_id,user_id,rating,review_text')
    .in('poi_id', poiIds)

  const byPoi = new Map()
  const reviewIds = []
  for (const review of (reviews || [])) {
    reviewIds.push(review.id)
    const current = byPoi.get(review.poi_id) || { ratingSum: 0, ratingCount: 0, commentCount: 0, commentUserIds: new Set(), reviewIds: [] }
    const rating = Number(review.rating || 0)
    if (rating > 0) {
      current.ratingSum += rating
      current.ratingCount += 1
    }
    if (String(review.review_text || '').trim()) {
      current.commentCount += 1
      if (review.user_id) current.commentUserIds.add(review.user_id)
    }
    current.reviewIds.push(review.id)
    byPoi.set(review.poi_id, current)
  }

  if (reviewIds.length) {
    const { data: replies } = await admin
      .from('poi_review_replies')
      .select('review_id,user_id')
      .in('review_id', reviewIds)

    const reviewToPoi = new Map()
    for (const [poiId, stats] of byPoi.entries()) {
      for (const reviewId of stats.reviewIds) reviewToPoi.set(reviewId, poiId)
    }
    for (const reply of (replies || [])) {
      const poiId = reviewToPoi.get(reply.review_id)
      if (!poiId) continue
      const current = byPoi.get(poiId)
      if (current) {
        current.commentCount += 1
        if (reply.user_id) current.commentUserIds.add(reply.user_id)
      }
    }
  }

  return Object.fromEntries(Array.from(byPoi.entries()).map(([poiId, stats]) => [poiId, {
    rating_average: stats.ratingCount ? stats.ratingSum / stats.ratingCount : null,
    rating_count: stats.ratingCount,
    comment_count: stats.commentCount,
    comment_user_count: stats.commentUserIds ? stats.commentUserIds.size : 0,
  }]))
}

async function buildFavoriteCounts(admin, poiIds = []) {
  if (!poiIds.length) return {}
  const { data } = await admin
    .from('favorites')
    .select('poi_id')
    .in('poi_id', poiIds)
  const counts = new Map()
  for (const row of (data || [])) counts.set(row.poi_id, (counts.get(row.poi_id) || 0) + 1)
  return Object.fromEntries(Array.from(counts.entries()).map(([poiId, count]) => [poiId, { favorite_count: count }]))
}

export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data: favs, error } = await auth.admin.from('favorites').select('id, poi_id').eq('user_id', auth.user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!favs?.length) return Response.json({ items: [] })

  const ids = favs.map((x) => x.poi_id)
  const { data: pois, error: poiError } = await auth.admin
    .from('pois')
    .select('id,title,slug,short_description,latitude,longitude,state,city,address,categories(name)')
    .in('id', ids)
    .eq('status', 'published')
  if (poiError) return Response.json({ error: poiError.message }, { status: 500 })

  const [imageMap, reviewStatsMap, favoriteStatsMap] = await Promise.all([
    getFavoriteImageMap(auth.admin, ids),
    buildFavoriteReviewStats(auth.admin, ids),
    buildFavoriteCounts(auth.admin, ids),
  ])
  const map = Object.fromEntries((pois || []).map((p) => {
    const image = imageMap[p.id] || {}
    const stats = { ...(reviewStatsMap[p.id] || {}), ...(favoriteStatsMap[p.id] || {}) }
    return [p.id, {
      ...p,
      category: p.categories?.name || '',
      image: image.cover_thumb_url || image.cover_url || '',
      cover_thumb_url: image.cover_thumb_url || null,
      cover_url: image.cover_url || null,
      cover_thumb_path: image.cover_thumb_path || null,
      cover_path: image.cover_path || null,
      rating_average: stats.rating_average || null,
      rating_count: stats.rating_count || 0,
      comment_count: stats.comment_count || 0,
      comment_user_count: stats.comment_user_count || 0,
      favorite_count: stats.favorite_count || 0,
    }]
  }))
  const items = favs.map((f) => ({ id: f.id, poi_id: f.poi_id, pois: map[f.poi_id] || null })).filter((x) => x.pois)
  return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error || 'Nicht angemeldet' }, { status: auth.status || 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const poiId = body?.poi_id
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { data: existing } = await auth.admin
    .from('favorites')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('poi_id', poiId)
    .maybeSingle()

  if (existing?.id) return Response.json({ item: existing, already_exists: true }, { headers: { 'Cache-Control': 'no-store' } })

  const { data, error } = await auth.admin
    .from('favorites')
    .insert({ user_id: auth.user.id, poi_id: poiId })
    .select('id,poi_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error || 'Nicht angemeldet' }, { status: auth.status || 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const poiId = body?.poi_id
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { error } = await auth.admin
    .from('favorites')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('poi_id', poiId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
