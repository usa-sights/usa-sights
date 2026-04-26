import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const categoryId = searchParams.get('category_id')
  const state = searchParams.get('state')
  const userQuery = searchParams.get('user')
  const missing = searchParams.get('missing')
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

  let query = auth.admin
    .from('pois')
    .select('*, categories(name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q}%`)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (state) query = query.eq('state', state)
  if (userQuery) query = query.eq('created_by', userQuery)
  if (missing === 'category') query = query.is('category_id', null)
  if (missing === 'description') query = query.or('description.is.null,description.eq.')

  const { data, error, count } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let items = data || []

  if (missing === 'images') {
    const ids = items.map((x) => x.id)
    if (ids.length) {
      const imgRes = await auth.admin.from('poi_images').select('poi_id').in('poi_id', ids)
      const withImages = new Set((imgRes.data || []).map((x) => x.poi_id))
      items = items.filter((x) => !withImages.has(x.id))
    }
  }
  if (missing === 'reviews') {
    const ids = items.map((x) => x.id)
    if (ids.length) {
      const revRes = await auth.admin.from('poi_reviews').select('poi_id').in('poi_id', ids)
      const withReviews = new Set((revRes.data || []).map((x) => x.poi_id))
      items = items.filter((x) => !withReviews.has(x.id))
    }
  }

  return Response.json({
    items,
    total: count || 0,
    limit,
    offset,
    has_more: (offset + limit) < (count || 0)
  }, { headers: { 'Cache-Control': 'no-store' } })
}
