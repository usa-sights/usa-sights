import { requireAdminRoute } from '@/utils/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.trim()

  let query = auth.admin
    .from('poi_external_links')
    .select('*, pois(title,slug)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`label.ilike.%${q}%,url.ilike.%${q}%`)

  const { data, error } = await query.limit(500)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { id, label, url, status } = body
  if (!id) return Response.json({ error: 'id fehlt' }, { status: 400 })

  const nextStatus = ['pending', 'published', 'rejected'].includes(status) ? status : 'pending'
  const { data, error } = await auth.admin
    .from('poi_external_links')
    .update({ label: label || null, url: url || null, status: nextStatus })
    .eq('id', id)
    .select('*, pois(title,slug)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id fehlt' }, { status: 400 })

  const { error } = await auth.admin.from('poi_external_links').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
