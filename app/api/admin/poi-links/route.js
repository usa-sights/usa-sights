import { requireAdminRoute } from '@/utils/supabase/auth'

function normalizeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

export async function GET(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })
  const { data, error } = await auth.admin.from('poi_external_links').select('*').eq('poi_id', poiId).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}

export async function POST(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const poi_id = body?.poi_id
  const label = String(body?.label || '').trim() || null
  const url = normalizeUrl(body?.url)
  if (!poi_id) return Response.json({ error: 'POI fehlt.' }, { status: 400 })
  if (!url) return Response.json({ error: 'Bitte eine gültige URL eingeben.' }, { status: 400 })

  const insertPayload = { poi_id, label, url, status: 'published' }
  if (auth.user?.id) insertPayload.submitted_by = auth.user.id

  const { data, error } = await auth.admin.from('poi_external_links').insert(insertPayload).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function PUT(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { id, label, status } = body
  const url = normalizeUrl(body?.url)
  if (!id) return Response.json({ error: 'Link-ID fehlt.' }, { status: 400 })
  if (!url) return Response.json({ error: 'Bitte eine gültige URL eingeben.' }, { status: 400 })
  const { data, error } = await auth.admin.from('poi_external_links').update({ label: String(label || '').trim() || null, url, status }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Link-ID fehlt.' }, { status: 400 })
  const { error } = await auth.admin.from('poi_external_links').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
