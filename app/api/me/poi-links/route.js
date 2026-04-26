import { requireUserRoute } from '@/utils/supabase/auth'

export async function GET(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const { searchParams } = new URL(req.url)
  const poiId = searchParams.get('poi_id')
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const { data: poi } = await auth.admin.from('pois').select('created_by').eq('id', poiId).single()
  if (!poi || poi.created_by !== auth.user.id) return Response.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { data, error } = await auth.admin.from('poi_external_links').select('*').eq('poi_id', poiId).order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data || [] })
}

export async function POST(req) {
  const auth = await requireUserRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const body = await req.json()
  const { poi_id, label, url } = body

  const { data: poi } = await auth.admin.from('pois').select('created_by').eq('id', poi_id).single()
  if (!poi || poi.created_by !== auth.user.id) return Response.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('poi_external_links')
    .insert({ poi_id, label: label || null, url, submitted_by: auth.user.id, status: 'pending' })
    .select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
