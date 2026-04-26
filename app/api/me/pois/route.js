import { requireUserRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 100)
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

  const { data, error, count } = await auth.admin
    .from('pois')
    .select('*', { count: 'exact' })
    .eq('created_by', auth.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    items: data || [],
    total: count || 0,
    limit,
    offset,
    has_more: offset + limit < (count || 0),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const title = String(body.title || '').trim()
  const categoryId = body.category_id || null
  const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude)
  const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude)
  if (!title || !categoryId || latitude == null || longitude == null) return Response.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 })

  const duplicateWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: existingPending, error: existingError } = await auth.admin
    .from('pois')
    .select('id')
    .eq('created_by', auth.user.id)
    .eq('status', 'pending')
    .eq('title', title)
    .eq('latitude', latitude)
    .eq('longitude', longitude)
    .gte('created_at', duplicateWindow)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if (existingPending?.[0]?.id) return Response.json({ item: { id: existingPending[0].id }, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } })

  const payload = {
    title,
    category_id: categoryId,
    state: body.state || null,
    city: body.city || null,
    address: body.address || null,
    short_description: body.short_description || null,
    description: body.description || null,
    website_url: body.website_url || null,
    opening_hours_text: body.opening_hours_text || null,
    price_info_text: body.price_info_text || null,
    hotels_nearby_text: body.hotels_nearby_text || null,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poi'}-${Date.now()}`,
    latitude,
    longitude,
    status: 'pending',
    created_by: auth.user.id,
  }

  const { data, error } = await auth.admin.from('pois').insert(payload).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, ...payload } = body
  const { data, error } = await auth.admin.from('pois').update(payload).eq('id', id).eq('created_by', auth.user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
