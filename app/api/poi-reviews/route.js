import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { calculateRatingDistribution, calculateReviewStats, isReviewVerified, normalizeReviewRow, reviewHasVerificationInfo } from '@/lib/poiReviews'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function publicCacheHeaders() {
  return {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

function inPeriod(item, period) {
  if (!period || period === 'all') return true
  const created = new Date(item.created_at || item.updated_at || 0).getTime()
  if (!created) return false
  const now = Date.now()
  const days = period === '30d' ? 30 : period === '90d' ? 90 : period === '365d' ? 365 : 0
  if (!days) return true
  return created >= now - days * 24 * 60 * 60 * 1000
}

function applyReviewFilters(items, searchParams) {
  const stars = Number(searchParams.get('stars') || searchParams.get('rating') || 0)
  const textFilter = searchParams.get('text') || 'all'
  const period = searchParams.get('period') || 'all'
  const verified = searchParams.get('verified') || 'all'
  const sort = searchParams.get('sort') || 'newest'

  let filtered = [...items]
  if (Number.isFinite(stars) && stars >= 1 && stars <= 5) {
    filtered = filtered.filter((item) => Math.round(Number(item.rating || 0)) === stars)
  }
  if (textFilter === 'with') filtered = filtered.filter((item) => String(item.review_text || '').trim())
  if (textFilter === 'without') filtered = filtered.filter((item) => !String(item.review_text || '').trim())
  filtered = filtered.filter((item) => inPeriod(item, period))

  if (verified === 'yes') filtered = filtered.filter((item) => reviewHasVerificationInfo(item) && isReviewVerified(item))
  if (verified === 'no') filtered = filtered.filter((item) => reviewHasVerificationInfo(item) && !isReviewVerified(item))

  filtered.sort((a, b) => {
    if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0)
    if (sort === 'best') return Number(b.rating || 0) - Number(a.rating || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0)
    if (sort === 'worst') return Number(a.rating || 0) - Number(b.rating || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0)
    return new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0)
  })

  return filtered
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  const fresh = searchParams.get('fresh') === '1'
  const summaryOnly = searchParams.get('summary') === '1'
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400, headers: noStoreHeaders() })

  const admin = createSupabaseAdminClient()

  if (summaryOnly) {
    const { data: summaryRows, error: summaryError } = await admin
      .from('poi_reviews')
      .select('id,rating')
      .eq('poi_id', poiId)

    if (summaryError) return Response.json({ error: summaryError.message }, { status: 500, headers: noStoreHeaders() })

    const normalizedRows = (summaryRows || []).map((row) => normalizeReviewRow(row))
    const stats = calculateReviewStats(normalizedRows)
    return Response.json({
      items: [],
      count: stats.count,
      average: stats.average,
      total_count: stats.count,
      total_average: stats.average,
      distribution: calculateRatingDistribution(normalizedRows),
    }, {
      headers: fresh ? noStoreHeaders() : publicCacheHeaders(),
    })
  }

  const { data: reviews, error } = await admin
    .from('poi_reviews')
    .select('*')
    .eq('poi_id', poiId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500, headers: noStoreHeaders() })

  const reviewIds = (reviews || []).map((x) => x.id).filter(Boolean)
  let replies = []
  if (reviewIds.length) {
    const repliesResult = await admin
      .from('poi_review_replies')
      .select('*')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true })
    replies = repliesResult.data || []
  }

  const profileIds = Array.from(new Set([
    ...(reviews || []).map((x) => x.user_id).filter(Boolean),
    ...replies.map((x) => x.user_id).filter(Boolean),
  ]))

  let profileMap = new Map()
  if (profileIds.length) {
    const profileRes = await admin.from('profiles').select('id,name,email').in('id', profileIds)
    profileMap = new Map((profileRes.data || []).map((row) => [row.id, row.name || row.email || 'Nutzer']))
  }

  const allItems = (reviews || [])
    .map((review) => normalizeReviewRow(review, profileMap.get(review.user_id) || 'Nutzer'))
    .map((review) => ({
      ...review,
      replies: replies
        .filter((r) => r.review_id === review.id)
        .map((reply) => ({
          ...reply,
          reply_text: String(reply.reply_text || reply.text || reply.comment || '').trim(),
          author_name: profileMap.get(reply.user_id) || 'Nutzer',
          created_at: reply.created_at || new Date().toISOString(),
        })),
    }))

  const items = applyReviewFilters(allItems, searchParams)
  const allStats = calculateReviewStats(allItems)
  const { count, average } = calculateReviewStats(items)
  const opinionCount = items.filter((item) => String(item.review_text || '').trim()).length

  return Response.json({
    items,
    count,
    average,
    opinion_count: opinionCount,
    total_count: allStats.count,
    total_average: allStats.average,
    distribution: calculateRatingDistribution(allItems),
  }, {
    headers: fresh ? noStoreHeaders() : publicCacheHeaders(),
  })
}
