import { requireAdminRoute } from '@/utils/supabase/auth'

export async function POST(req) {
  const auth = await requireAdminRoute(req)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const poiId = body.poi_id
  if (!poiId) return Response.json({ error: 'poi_id fehlt' }, { status: 400 })

  const now = new Date().toISOString()

  const { data: poi, error: poiError } = await auth.admin
    .from('pois')
    .update({
      status: 'published',
      approved_by: auth.user.id,
      updated_at: now,
    })
    .eq('id', poiId)
    .select('*, categories(name)')
    .single()

  if (poiError) return Response.json({ error: poiError.message }, { status: 500 })

  const { data: imgRows, error: imgError } = await auth.admin
    .from('poi_images')
    .update({ status: 'approved' })
    .eq('poi_id', poiId)
    .in('status', ['pending', 'approved'])
    .select('id')

  if (imgError) return Response.json({ error: imgError.message }, { status: 500 })

  const { data: linkRows, error: linkError } = await auth.admin
    .from('poi_external_links')
    .update({ status: 'published', updated_at: now })
    .eq('poi_id', poiId)
    .in('status', ['pending', 'published'])
    .select('id')

  if (linkError && !String(linkError.message || '').toLowerCase().includes('relation')) {
    return Response.json({ error: linkError.message }, { status: 500 })
  }

  return Response.json({
    item: poi,
    approved_image_count: (imgRows || []).length,
    approved_link_count: (linkRows || []).length,
  })
}
