import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')

  let query = auth.admin
    .from('pois')
    .select('*, categories(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (poiId) query = query.eq('id', poiId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [], count: (data || []).length }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, ...payload } = body
  const { data, error } = await auth.admin.from('pois').update(payload).eq('id', id).select('*, categories(name)').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
