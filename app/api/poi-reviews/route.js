import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const admin = adminClient()
  const { data: reviews, error } = await admin
    .from('poi_reviews')
    .select('*')
    .eq('poi_id', poiId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const reviewIds = (reviews || []).map((x) => x.id)
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
    const profileRes = await admin.from('profiles').select('id,name').in('id', profileIds)
    profileMap = new Map((profileRes.data || []).map((row) => [row.id, row.name || 'Nutzer']))
  }

  const items = (reviews || []).map((review) => ({
    ...review,
    author_name: profileMap.get(review.user_id) || 'Nutzer',
    replies: replies
      .filter((r) => r.review_id === review.id)
      .map((reply) => ({
        ...reply,
        author_name: profileMap.get(reply.user_id) || 'Nutzer',
      })),
  }))

  const count = items.length
  const average = count ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / count : 0

  return Response.json({ items, count, average }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
