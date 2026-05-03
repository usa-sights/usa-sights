import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { calculateReviewStats, normalizeReviewRow } from '@/lib/poiReviews'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400, headers: noStoreHeaders() })

  const admin = createSupabaseAdminClient()
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

  const items = (reviews || [])
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

  const { count, average } = calculateReviewStats(items)
  const opinionCount = items.filter((item) => String(item.review_text || '').trim()).length

  return Response.json({ items, count, average, opinion_count: opinionCount }, {
    headers: noStoreHeaders(),
  })
}
