import { requireAdminRoute } from '@/utils/supabase/auth'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin.from('categories').select('*').order('sort_order')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ids = (data || []).map((c) => c.id)
  const counts = {}
  if (ids.length) {
    const { data: pois } = await auth.admin.from('pois').select('id,category_id').in('category_id', ids)
    for (const poi of (pois || [])) counts[poi.category_id] = (counts[poi.category_id] || 0) + 1
  }

  return Response.json({ items: (data || []).map((c) => ({ ...c, poi_count: counts[c.id] || 0 })) })
}

export async function POST(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { data, error } = await auth.admin.from('categories').insert(body).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, ...payload } = body
  const { data, error } = await auth.admin.from('categories').update(payload).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await auth.admin.from('categories').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
