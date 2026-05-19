import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

function currentMonthKey() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

async function attachViewStats(admin, items) {
  const ids = items.map((x) => x.id).filter(Boolean)
  if (!ids.length) return items

  const { data, error } = await admin
    .from('poi_view_stats')
    .select('poi_id,month_key,view_count')
    .in('poi_id', ids)

  if (error) {
    return items.map((item) => ({ ...item, view_count_month: 0, view_count_all: 0 }))
  }

  const month = currentMonthKey()
  const stats = new Map()
  for (const row of data || []) {
    const current = stats.get(row.poi_id) || { month: 0, all: 0 }
    const count = Number(row.view_count || 0)
    current.all += count
    if (row.month_key === month) current.month += count
    stats.set(row.poi_id, current)
  }

  return items.map((item) => {
    const itemStats = stats.get(item.id) || { month: 0, all: 0 }
    return { ...item, view_count_month: itemStats.month, view_count_all: itemStats.all }
  })
}

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

  items = await attachViewStats(auth.admin, items)

  return Response.json({
    items,
    total: count || 0,
    limit,
    offset,
    has_more: (offset + limit) < (count || 0)
  }, { headers: { 'Cache-Control': 'no-store' } })
}
